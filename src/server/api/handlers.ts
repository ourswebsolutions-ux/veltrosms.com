import "server-only";
import { z } from "zod";
import { resolveDateRange } from "@/lib/date-range";
import { parseAmount } from "@/lib/money";
import { getOrderStats, listTransactions } from "@/server/services/account.service";
import {
  cancelOrder,
  finishOrder,
  getOrder,
  listOrders,
  requestAnotherSms,
  requestNumber,
  type OrderActionResult,
} from "@/server/services/order.service";
import { db } from "@/server/db";
import { getBalance } from "@/server/services/wallet.service";
import { apiError, HTTP_FOR_ORDER_ERROR, json, readJson, withAuth } from "./http";

/**
 * Handlers shared by the session endpoints (/api/wallet, /api/orders, …) and
 * the public API-key endpoints (/api/v1/…). Nothing here can credit or debit a
 * wallet directly; balances only change through orders (and staff tools).
 */

const TX_TYPES = ["deposit", "purchase", "refund", "adjustment"] as const;

const orderResponse = (result: OrderActionResult, created = false) =>
  result.ok
    ? json({ order: result.order }, { status: created ? 201 : 200 })
    : apiError(HTTP_FOR_ORDER_ERROR[result.code] ?? 400, result.code, result.message, result.prices ? { prices: result.prices } : {});

/* ---------------------------------------------------------------- wallet -- */

export const getWallet = withAuth(async (_req, { user }) => {
  const w = await getBalance(user.id);
  return json({ balance: w.balance, currency: w.currency, updatedAt: w.updatedAt.toISOString() });
});

const txQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(TX_TYPES).optional(),
  status: z.enum(["pending", "completed", "failed"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  min: z.string().optional(),
  max: z.string().optional(),
});

export const getWalletTransactions = withAuth(async (req, { user }) => {
  const q = txQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return apiError(400, "INVALID", "Invalid query parameters.");
  const min = q.data.min !== undefined ? parseAmount(q.data.min) : undefined;
  const max = q.data.max !== undefined ? parseAmount(q.data.max) : undefined;
  if (min === null || max === null) return apiError(400, "INVALID", "Amounts must look like 10 or 0.25.");
  const page = await listTransactions(user.id, {
    page: q.data.page,
    pageSize: q.data.pageSize,
    types: q.data.type ? [q.data.type.toUpperCase() as Uppercase<(typeof TX_TYPES)[number]>] : undefined,
    status: q.data.status?.toUpperCase() as "PENDING" | "COMPLETED" | "FAILED" | undefined,
    from: q.data.from ? new Date(`${q.data.from}T00:00:00Z`) : undefined,
    to: q.data.to ? new Date(`${q.data.to}T23:59:59.999Z`) : undefined,
    minAmount: min,
    maxAmount: max,
  });
  return json(page);
});

/* ---------------------------------------------------------------- orders -- */

const ordersQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "completed", "cancelled", "all"]).default("all"),
});

export const getOrders = withAuth(async (req, { user }) => {
  const q = ordersQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listOrders(user.id, q.data));
});

const createBody = z.object({
  service: z.string().min(1).max(64),
  country: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().positive()]).transform(String),
  /** Price you agree to pay, in minor units (1/10,000). Must match the current price. */
  price: z.number().int().positive().max(1_000_000_000),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).optional(),
});

export const postOrder = withAuth(async (req, { user }) => {
  const body = createBody.safeParse(await readJson(req));
  if (!body.success) return apiError(400, "INVALID", "Body must include service, country and price.");
  const key = body.data.idempotencyKey ?? req.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
    return apiError(400, "INVALID", "Provide an Idempotency-Key header (16–64 letters, digits, _ or -).");
  }
  return orderResponse(await requestNumber(user.id, { ...body.data, idempotencyKey: key }), true);
});

const idParam = z.uuid();

export const getOrderById = withAuth<{ id: string }>(async (_req, { user, params }) => {
  if (!idParam.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
  const order = await getOrder(user.id, params.id);
  return order ? json({ order }) : apiError(404, "NOT_FOUND", "Order not found.");
});

const orderAction = (fn: typeof cancelOrder) =>
  withAuth<{ id: string }>(async (_req, { user, params }) => {
    if (!idParam.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
    return orderResponse(await fn(user.id, params.id));
  });

export const postCancelOrder = orderAction(cancelOrder);
export const postFinishOrder = orderAction(finishOrder);
export const postResendOrder = orderAction(requestAnotherSms);

/* ------------------------------------------------------------ statistics -- */

export const getStatistics = withAuth(async (req, { user }) => {
  const q = req.nextUrl.searchParams;
  const range = resolveDateRange({ range: q.get("range") ?? undefined, from: q.get("from") ?? undefined, to: q.get("to") ?? undefined });
  if (range.error) return apiError(400, "INVALID", range.error);
  return json({ range: { label: range.label, from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null }, ...(await getOrderStats(user.id, range)) });
});

/* ------------------------------------------------------------------- sms -- */

/** All SMS received for one of the caller's orders (ownership enforced). */
export const getOrderSms = withAuth<{ id: string }>(async (_req, { user, params }) => {
  if (!idParam.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
  // Refresh first so a just-arrived code is included (throttled server-side).
  const order = await getOrder(user.id, params.id);
  if (!order) return apiError(404, "NOT_FOUND", "Order not found.");
  const messages = await db().sms.findMany({
    where: { orderId: params.id, order: { userId: user.id } },
    orderBy: { receivedAt: "asc" },
    select: { code: true, text: true, sender: true, receivedAt: true },
  });
  return json({
    orderId: order.id,
    status: order.status,
    messages: messages.map((m) => ({ code: m.code, text: m.text, sender: m.sender, receivedAt: m.receivedAt.toISOString() })),
  });
});
