import "server-only";
import { serviceLogo } from "@/lib/service-logos";
import { createHash } from "node:crypto";
import { toDecimalString, toMinor } from "@/lib/money";
import { hitRateLimit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { serviceColor } from "@/server/catalog/service-hints";
import { db, isUniqueViolation, type Prisma } from "@/server/db";
import type { OrderStatus as DbOrderStatus } from "@/generated/prisma/client";
import { getProvider } from "@/server/providers/registry";
import { ProviderError, type ProviderActivation } from "@/server/providers/types";
import type { OrderDetail, OrderFilter, OrderListItem, OrderStatus, Page, SmsHistoryItem, TransactionType } from "@/types/account";
import { quote } from "./catalog.service";
import { getSetting } from "./settings.service";
import { getProviderBalance, invalidateProviderBalance } from "./provider-health.service";
import { platformCurrency } from "./currency";
import { applyInTx, WalletError } from "./wallet.service";

/**
 * Number orders: purchase → wait for SMS → finish / cancel / expire.
 *
 * Money rules:
 *  - the customer is charged in the same DB transaction that creates the order;
 *  - every path that ends without a delivered code refunds exactly once
 *    (refund reference "order:<id>:refund" is unique);
 *  - prices are always re-quoted server-side; client values are only used to
 *    confirm the customer agreed to the current price.
 */

const DEFAULT_TTL_SECONDS = 20 * 60;
const CHECK_INTERVAL_MS = 5_000;
/**
 * A PENDING order without a provider activation this old was interrupted
 * (e.g. server restart mid-purchase). The purchase call itself times out
 * after 30 s, so by now it can't still be running.
 */
const STALE_PENDING_MS = 2 * 60_000;
const LIVE: DbOrderStatus[] = ["PENDING", "ACTIVE", "SMS_RECEIVED"];

export type OrderActionResult =
  | { ok: true; order: OrderListItem }
  | {
      ok: false;
      code:
        | "INVALID"
        | "UNAVAILABLE"
        | "PRICE_CHANGED"
        | "INSUFFICIENT_FUNDS"
        | "NO_NUMBERS"
        | "RATE_LIMITED"
        | "NOT_ALLOWED"
        | "NOT_FOUND"
        | "PROVIDER_ERROR";
      message: string;
      prices?: number[];
    };

/* ------------------------------------------------------------------ DTOs -- */

const orderInclude = {
  service: { select: { slug: true, name: true, providerCode: true } },
  country: { select: { id: true, iso2: true, name: true } },
  sms: { orderBy: { receivedAt: "asc" }, take: 20, select: { id: true, code: true, text: true, sender: true, receivedAt: true } },
  _count: { select: { sms: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderItem(o: OrderRow): OrderListItem {
  const status = o.status.toLowerCase() as OrderStatus;
  const latest = o.sms.at(-1);
  const hasSms = o._count.sms > 0;
  return {
    id: o.id,
    service: {
      slug: o.service.slug,
      name: o.service.name,
      color: serviceColor(o.service.providerCode, o.service.name),
      logo: serviceLogo(o.service.providerCode),
    },
    country: { id: String(o.country.id), iso2: o.country.iso2, name: o.country.name },
    phoneNumber: o.phoneNumber,
    status,
    price: toMinor(o.price),
    currency: o.currency,
    code: latest?.code ?? null,
    smsText: latest?.text ?? null,
    smsCount: o._count.sms,
    messages: o.sms.map((m) => ({ id: m.id, code: m.code, text: m.text, sender: m.sender, receivedAt: m.receivedAt.toISOString() })),
    createdAt: o.createdAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    cancelableAt: o.cancelableAt?.toISOString() ?? null,
    canCancel: o.status === "ACTIVE" && !hasSms,
    canFinish: o.status === "SMS_RECEIVED",
    canRequestAnother: o.status === "SMS_RECEIVED" && o.canGetAnotherSms,
  };
}

async function loadOrder(userId: string, orderId: string): Promise<OrderRow | null> {
  return db().order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
}

/* ------------------------------------------------------------ finalizing -- */

/**
 * Moves a live order to a final status exactly once. With `refund`, the charge
 * is returned in the same transaction. Returns false if already finalized.
 */
async function finalize(orderId: string, status: DbOrderStatus, opts: { refund: boolean; reason?: string }): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { service: { select: { name: true } }, country: { select: { name: true } } },
    });
    if (!order) return false;
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: { in: LIVE } },
      data: {
        status,
        completedAt: new Date(),
        ...(opts.reason ? { failureReason: opts.reason.slice(0, 255) } : {}),
      },
    });
    if (count === 0) return false;
    if (opts.refund) {
      await applyInTx(
        tx,
        {
          userId: order.userId,
          amount: toMinor(order.price),
          type: "REFUND",
          reference: `order:${order.id}:refund`,
          description: `Refund · ${order.service.name} · ${order.country.name}`,
          orderId: order.id,
        },
        1,
      );
    }
    return true;
  });
}

/* -------------------------------------------------------------- purchase -- */

/**
 * Attaches the provider's activation to a PENDING order. Returns false when
 * the order was already finalized (and refunded) meanwhile: the activation is
 * then released at the provider instead of reviving the order.
 */
async function activateOrder(orderId: string, activation: ProviderActivation, ctx: { orderId: string; userId: string }): Promise<boolean> {
  const now = Date.now();
  const { count } = await db().order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: {
      status: "ACTIVE",
      providerActivationId: activation.activationId,
      phoneNumber: activation.phoneNumber,
      ...(activation.cost !== null ? { providerCost: toDecimalString(activation.cost) } : {}),
      canGetAnotherSms: activation.canGetAnotherSms,
      cancelableAt: activation.cancelAfterSeconds !== null ? new Date(now + activation.cancelAfterSeconds * 1000) : null,
      expiresAt: new Date(now + (activation.expiresInSeconds ?? DEFAULT_TTL_SECONDS) * 1000),
    },
  });
  if (count === 0) {
    console.warn(JSON.stringify({ level: "warn", source: "orders", event: "activation_released", orderId, providerRef: activation.activationId }));
    await getProvider().changeStatus(activation.activationId, "cancel", ctx).catch(() => {});
    return false;
  }
  return true;
}

/**
 * After an ambiguous purchase failure, finds an activation the provider did
 * open for this service/country that no order owns yet. Returns null when
 * there is none (then the purchase really failed and is refunded).
 */
async function reconcilePurchase(serviceCode: string, countryCode: string, ctx: { orderId: string; userId: string }): Promise<ProviderActivation | null> {
  try {
    const provider = getProvider();
    const open = (await provider.getActiveActivations(ctx)).filter((a) => a.serviceCode === serviceCode && a.countryCode === countryCode);
    if (!open.length) return null;
    const owned = await db().order.findMany({
      where: { provider: provider.id, providerActivationId: { in: open.map((a) => a.activationId) } },
      select: { providerActivationId: true },
    });
    const taken = new Set(owned.map((o) => o.providerActivationId));
    const orphan = open.filter((a) => !taken.has(a.activationId)).sort((a, b) => Number(b.activationId) - Number(a.activationId))[0];
    if (!orphan) return null;
    console.warn(JSON.stringify({ level: "warn", source: "orders", event: "purchase_reconciled", orderId: ctx.orderId, providerRef: orphan.activationId }));
    return {
      activationId: orphan.activationId,
      phoneNumber: orphan.phoneNumber,
      cost: orphan.cost,
      canGetAnotherSms: false,
      cancelAfterSeconds: null,
      expiresInSeconds: null,
    };
  } catch {
    return null;
  }
}

const PROVIDER_MESSAGES: Partial<Record<ProviderError["code"], { code: Extract<OrderActionResult, { ok: false }>["code"]; message: string }>> = {
  NO_NUMBERS: { code: "NO_NUMBERS", message: "No numbers are available right now for this country. Try another country or try again shortly." },
  PRICE_TOO_LOW: { code: "PRICE_CHANGED", message: "The price has just changed. Please review the new price." },
  SERVICE_BLOCKED: { code: "UNAVAILABLE", message: "This service is currently unavailable. Please choose another one." },
};

/** Failure message for an order that ended without a number (by stored reason). */
function failedResult(reason: string | null): OrderActionResult {
  const mapped = reason ? PROVIDER_MESSAGES[reason as ProviderError["code"]] : undefined;
  if (mapped) return { ok: false, ...mapped, message: `${mapped.message} You have not been charged.` };
  return { ok: false, code: "PROVIDER_ERROR", message: "We couldn't get a number right now. You have not been charged." };
}

/**
 * Outcome of a repeated submit: the same order, or the same failure — a
 * failed (refunded) purchase is never reported as a successful one.
 */
function replay(order: OrderRow): OrderActionResult {
  if (order.status === "FAILED") return failedResult(order.failureReason);
  return { ok: true, order: toOrderItem(order) };
}

export async function requestNumber(
  userId: string,
  input: { service: string; country: string; price: number; idempotencyKey: string },
): Promise<OrderActionResult> {
  // A resubmitted request returns the order it already created.
  const existing = await db().order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    include: orderInclude,
  });
  if (existing) return replay(existing);

  const maintenance = await getSetting("maintenance");
  if (maintenance.enabled) {
    return { ok: false, code: "UNAVAILABLE", message: maintenance.message || "We're doing maintenance. Buying numbers is paused for a short while." };
  }

  const limit = await hitRateLimit(`purchase:user:${userId}`, RATE_LIMITS.purchasePerUser);
  if (!limit.allowed) return { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please wait a moment." };

  const provider = getProvider();
  if (!provider.capabilities.has("purchase")) {
    return { ok: false, code: "UNAVAILABLE", message: "Buying numbers is temporarily unavailable." };
  }

  const q = await quote(input.service, input.country, input.price);
  if (!q) return { ok: false, code: "INVALID", message: "This offer is no longer available." };
  if (!q.match) {
    return { ok: false, code: "PRICE_CHANGED", message: "The price has changed. Please review the new price.", prices: q.currentPrices };
  }

  // 1. Pre-flight: make sure our provider account can pay for it, so the
  //    customer isn't charged for a purchase that can't succeed.
  try {
    const providerBalance = await getProviderBalance();
    if (providerBalance < q.match.providerCost) {
      console.error("[orders] provider balance too low for purchases — top up the provider account");
      return { ok: false, code: "UNAVAILABLE", message: "Buying numbers is temporarily unavailable. You have not been charged." };
    }
  } catch (error) {
    console.error("[orders] provider unreachable before purchase:", error instanceof ProviderError ? error.code : error);
    return { ok: false, code: "UNAVAILABLE", message: "The number service is temporarily unavailable. You have not been charged." };
  }

  // 2. Create the order and charge for it atomically.
  let orderId: string;
  try {
    orderId = await db().$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: q.serviceId,
          countryId: q.countryId,
          provider: provider.id,
          status: "PENDING",
          price: toDecimalString(q.match!.price),
          currency: platformCurrency().code,
          providerCost: toDecimalString(q.match!.providerCost),
          idempotencyKey: input.idempotencyKey,
        },
      });
      await applyInTx(
        tx,
        {
          userId,
          amount: q.match!.price,
          type: "PURCHASE",
          reference: `order:${order.id}:charge`,
          description: q.label,
          orderId: order.id,
        },
        -1,
      );
      return order.id;
    });
  } catch (error) {
    if (error instanceof WalletError && error.code === "INSUFFICIENT_FUNDS") {
      return { ok: false, code: "INSUFFICIENT_FUNDS", message: "Not enough balance. Please top up your balance." };
    }
    if (isUniqueViolation(error)) {
      // Same idempotency key submitted concurrently: return the winner.
      const winner = await db().order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
        include: orderInclude,
      });
      if (winner) return replay(winner);
    }
    throw error;
  }

  // 3. Ask the provider for the number (outside the DB transaction; never retried).
  const ctx = { orderId, userId };
  try {
    let activation: ProviderActivation;
    try {
      activation = await provider.purchaseNumber(
        { serviceCode: q.serviceCode, countryCode: q.countryCode, maxCost: q.match.providerCost },
        ctx,
      );
    } catch (error) {
      // Timeouts/garbled answers are ambiguous: the provider may have issued
      // a number anyway. Look for it before deciding to refund.
      const adopted = error instanceof ProviderError && error.ambiguous ? await reconcilePurchase(q.serviceCode, q.countryCode, ctx) : null;
      if (!adopted) throw error;
      activation = adopted;
    } finally {
      invalidateProviderBalance();
    }
    if (!(await activateOrder(orderId, activation, ctx))) {
      // Finalized meanwhile (stale-order recovery): report the stored outcome.
      return replay((await loadOrder(userId, orderId))!);
    }
  } catch (error) {
    // Confirmed that nothing was delivered: refund and record why.
    const reason = error instanceof ProviderError ? error.code : "INTERNAL";
    await finalize(orderId, "FAILED", { refund: true, reason });
    if (error instanceof ProviderError) {
      if (error.code === "UNAUTHORIZED" || error.code === "PROVIDER_NO_BALANCE") {
        invalidateProviderBalance();
        console.error(`[orders] provider account problem (${error.code}) — check provider credentials/balance`);
      }
      return failedResult(error.code);
    }
    throw error;
  }

  const order = await loadOrder(userId, orderId);
  return { ok: true, order: toOrderItem(order!) };
}

/* ---------------------------------------------------------- status sync -- */

async function recordSms(orderId: string, sms: { code: string | null; text: string; receivedAt: Date | null }) {
  const providerRef = createHash("sha256").update(`${sms.code ?? ""}|${sms.text}`).digest("hex").slice(0, 64);
  try {
    await db().sms.create({
      data: {
        orderId,
        code: sms.code?.slice(0, 32) ?? null,
        text: sms.text.slice(0, 5000),
        providerRef,
        receivedAt: sms.receivedAt ?? new Date(),
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error; // already stored
  }
}

/**
 * Brings a live order up to date with the provider (throttled), storing new
 * SMS and finalizing cancelled/expired activations with refunds.
 */
export async function refreshOrder(orderId: string, opts: { force?: boolean } = {}): Promise<void> {
  const order = await db().order.findUnique({
    where: { id: orderId },
    include: { _count: { select: { sms: true } }, service: { select: { providerCode: true } }, country: { select: { providerCode: true } } },
  });
  if (!order || !LIVE.includes(order.status)) return;
  const hasSms = order._count.sms > 0;
  const now = Date.now();

  // Purchase interrupted before the provider's answer was saved (server
  // restart, crash): the provider may still have issued the number, so look
  // for it before refunding.
  if (!order.providerActivationId) {
    if (now - order.createdAt.getTime() < STALE_PENDING_MS) return;
    const ctx = { orderId: order.id, userId: order.userId };
    const adopted = await reconcilePurchase(order.service.providerCode, order.country.providerCode, ctx);
    if (adopted && (await activateOrder(order.id, adopted, ctx))) return;
    await finalize(order.id, "FAILED", { refund: true, reason: "NO_ACTIVATION" });
    return;
  }
  if (!opts.force && order.lastCheckedAt && now - order.lastCheckedAt.getTime() < CHECK_INTERVAL_MS) return;

  const provider = getProvider();
  await db().order.update({ where: { id: order.id }, data: { lastCheckedAt: new Date(now) } });

  // Past its lifetime: close it out.
  if (order.expiresAt && order.expiresAt.getTime() <= now) {
    if (hasSms) {
      await provider.changeStatus(order.providerActivationId, "finish", { orderId: order.id, userId: order.userId }).catch(() => {});
      await finalize(order.id, "COMPLETED", { refund: false });
    } else {
      await provider.changeStatus(order.providerActivationId, "cancel", { orderId: order.id, userId: order.userId }).catch(() => {});
      await finalize(order.id, "EXPIRED", { refund: true, reason: "No SMS before expiry" });
    }
    return;
  }

  const ctx = { orderId: order.id, userId: order.userId };
  const state = await provider.getActivationState(order.providerActivationId, ctx);
  switch (state.state) {
    case "code": {
      const sms = await provider.getLatestSms(order.providerActivationId, ctx).catch(() => null);
      await recordSms(order.id, sms ?? { code: state.code, text: state.code, receivedAt: null });
      if (order.status !== "SMS_RECEIVED") {
        await db().order.updateMany({ where: { id: order.id, status: { in: LIVE } }, data: { status: "SMS_RECEIVED" } });
      }
      return;
    }
    case "waiting_retry":
      if (order.status === "SMS_RECEIVED") {
        await db().order.updateMany({ where: { id: order.id, status: "SMS_RECEIVED" }, data: { status: "ACTIVE" } });
      }
      return;
    case "cancelled":
      // The provider cancelled it (and refunded us): refund the customer if no code arrived.
      await finalize(order.id, hasSms ? "COMPLETED" : "CANCELLED", { refund: !hasSms, reason: "Cancelled by provider" });
      return;
    case "not_found":
      // Possibly transient; the order is closed (and refunded) once its lifetime passes.
      console.warn(JSON.stringify({ level: "warn", source: "orders", event: "activation_not_found", orderId: order.id }));
      return;
    case "waiting":
      return;
  }
}

/** Refreshes and returns one of the user's orders. */
export async function getOrder(userId: string, orderId: string): Promise<OrderListItem | null> {
  const order = await db().order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true } });
  if (!order) return null;
  if (LIVE.includes(order.status)) {
    await refreshOrder(order.id).catch((error: unknown) =>
      console.warn("[orders] refresh failed:", error instanceof Error ? error.message : error),
    );
  }
  const row = await loadOrder(userId, orderId);
  return row ? toOrderItem(row) : null;
}

/** One of the user's orders with its ledger entries (charge, refund). */
export async function getOrderDetail(userId: string, orderId: string): Promise<OrderDetail | null> {
  const order = await getOrder(userId, orderId);
  if (!order) return null;
  const ledger = await db().transaction.findMany({ where: { orderId, userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return {
    order,
    ledger: ledger.map((t) => ({
      id: t.id,
      type: t.type.toLowerCase() as TransactionType,
      amount: toMinor(t.amount),
      balanceAfter: toMinor(t.balanceAfter),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/** Every SMS the user received, newest first (paginated, filtered in the database). */
export async function listSmsHistory(
  userId: string,
  filter: { q?: string; from?: Date; to?: Date; page?: number; pageSize?: number } = {},
): Promise<Page<SmsHistoryItem>> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const q = filter.q?.trim();
  const where: Prisma.SmsWhereInput = {
    order: {
      userId,
      ...(q ? { OR: [{ service: { name: { contains: q } } }, { country: { name: { contains: q } } }, { phoneNumber: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    ...(filter.from || filter.to ? { receivedAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
  };
  const [rows, total] = await Promise.all([
    db().sms.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            phoneNumber: true,
            service: { select: { name: true, providerCode: true } },
            country: { select: { iso2: true, name: true } },
          },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db().sms.count({ where }),
  ]);
  return {
    items: rows.map((m) => ({
      id: m.id,
      orderId: m.order.id,
      service: {
        name: m.order.service.name,
        color: serviceColor(m.order.service.providerCode, m.order.service.name),
        logo: serviceLogo(m.order.service.providerCode),
      },
      country: { iso2: m.order.country.iso2, name: m.order.country.name },
      phoneNumber: m.order.phoneNumber,
      sender: m.sender,
      code: m.code,
      text: m.text,
      receivedAt: m.receivedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
}

/* --------------------------------------------------------- user actions -- */

async function guardAction(userId: string, orderId: string) {
  const order = await db().order.findFirst({ where: { id: orderId, userId }, include: { _count: { select: { sms: true } } } });
  if (!order) return { error: { ok: false, code: "NOT_FOUND", message: "Order not found." } as OrderActionResult };
  await refreshOrder(order.id, { force: true }).catch(() => {});
  const fresh = await db().order.findUnique({ where: { id: orderId }, include: { _count: { select: { sms: true } } } });
  return { order: fresh! };
}

async function done(userId: string, orderId: string): Promise<OrderActionResult> {
  return { ok: true, order: toOrderItem((await loadOrder(userId, orderId))!) };
}

export async function cancelOrder(userId: string, orderId: string): Promise<OrderActionResult> {
  const g = await guardAction(userId, orderId);
  if (g.error) return g.error;
  const order = g.order;
  if (order.status !== "ACTIVE" || order._count.sms > 0 || !order.providerActivationId) {
    return { ok: false, code: "NOT_ALLOWED", message: "This number can no longer be cancelled." };
  }
  if (order.cancelableAt && order.cancelableAt.getTime() > Date.now()) {
    const time = order.cancelableAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return { ok: false, code: "NOT_ALLOWED", message: `This number can be cancelled after ${time}.` };
  }
  const provider = getProvider();
  const ctx = { orderId: order.id, userId };
  try {
    await provider.changeStatus(order.providerActivationId, "cancel", ctx);
  } catch (error) {
    if (error instanceof ProviderError && error.code === "EARLY_CANCEL") {
      return { ok: false, code: "NOT_ALLOWED", message: "It's too early to cancel this number. Please try again in a minute." };
    }
    // Refund only if the provider's own status confirms the activation is closed.
    const state = await provider.getActivationState(order.providerActivationId, ctx).catch(() => null);
    const expired = order.expiresAt !== null && order.expiresAt.getTime() <= Date.now();
    const confirmed = state?.state === "cancelled" || (state?.state === "not_found" && expired);
    if (!confirmed) {
      return { ok: false, code: "PROVIDER_ERROR", message: "We couldn't cancel right now. Please try again in a moment." };
    }
  }
  await finalize(order.id, "CANCELLED", { refund: true, reason: "Cancelled by customer" });
  return done(userId, orderId);
}

export async function finishOrder(userId: string, orderId: string): Promise<OrderActionResult> {
  const g = await guardAction(userId, orderId);
  if (g.error) return g.error;
  const order = g.order;
  if (order.status !== "SMS_RECEIVED" || !order.providerActivationId) {
    return { ok: false, code: "NOT_ALLOWED", message: "Only numbers that received a code can be finished." };
  }
  await getProvider()
    .changeStatus(order.providerActivationId, "finish", { orderId: order.id, userId })
    .catch((error: unknown) => console.warn("[orders] finish at provider failed:", error instanceof Error ? error.message : error));
  await finalize(order.id, "COMPLETED", { refund: false });
  return done(userId, orderId);
}

export async function requestAnotherSms(userId: string, orderId: string): Promise<OrderActionResult> {
  const g = await guardAction(userId, orderId);
  if (g.error) return g.error;
  const order = g.order;
  if (order.status !== "SMS_RECEIVED" || !order.canGetAnotherSms || !order.providerActivationId) {
    return { ok: false, code: "NOT_ALLOWED", message: "Another code can't be requested for this number." };
  }
  try {
    await getProvider().changeStatus(order.providerActivationId, "request_another", { orderId: order.id, userId });
  } catch {
    return { ok: false, code: "PROVIDER_ERROR", message: "We couldn't request another code. Please try again." };
  }
  await db().order.updateMany({ where: { id: order.id, status: "SMS_RECEIVED" }, data: { status: "ACTIVE" } });
  return done(userId, orderId);
}

/* ----------------------------------------------------------------- lists -- */

const FILTER_STATUSES: Record<NonNullable<OrderFilter["status"]>, DbOrderStatus[] | null> = {
  all: null,
  active: LIVE,
  completed: ["COMPLETED"],
  cancelled: ["CANCELLED", "REFUNDED", "FAILED", "EXPIRED"],
};

export async function listOrders(userId: string, filter: OrderFilter = {}): Promise<Page<OrderListItem>> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const statuses = FILTER_STATUSES[filter.status ?? "all"];
  const q = filter.q?.trim();
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { service: { name: { contains: q } } },
            { country: { name: { contains: q } } },
            { phoneNumber: { contains: q.replace(/\D/g, "") || q } },
            // Order ID (as shown: "#1a2b3c4d"), prefix match on the primary key.
            ...(/^#?[0-9a-f-]{4,36}$/i.test(q) ? [{ id: { startsWith: q.replace(/^#/, "").toLowerCase() } }] : []),
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db().order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db().order.count({ where }),
  ]);
  return { items: rows.map(toOrderItem), total, page, pageSize };
}

/** Live orders, refreshed from the provider first (throttled). */
export async function listActiveOrders(userId: string): Promise<OrderListItem[]> {
  const live = await db().order.findMany({ where: { userId, status: { in: LIVE } }, select: { id: true }, take: 50 });
  await Promise.all(live.map((o) => refreshOrder(o.id).catch(() => {})));
  const rows = await db().order.findMany({
    where: { userId, status: { in: LIVE } },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toOrderItem);
}

/**
 * Finalizes live orders whose lifetime has passed (refunding when no SMS
 * arrived). Run periodically (npm run orders:sweep) so refunds don't depend
 * on the customer coming back.
 */
export async function sweepExpiredOrders(limit = 200): Promise<number> {
  const due = await db().order.findMany({
    where: {
      status: { in: LIVE },
      OR: [{ expiresAt: { lt: new Date() } }, { providerActivationId: null, createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } }],
    },
    select: { id: true },
    take: limit,
  });
  for (const o of due) {
    await refreshOrder(o.id, { force: true }).catch((error: unknown) =>
      console.warn("[orders] sweep failed for an order:", error instanceof Error ? error.message : error),
    );
  }
  return due.length;
}
