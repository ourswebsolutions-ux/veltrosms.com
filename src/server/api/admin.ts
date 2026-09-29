import "server-only";
import { z } from "zod";
import { resolveDateRange } from "@/lib/date-range";
import { adminCancelOrder, adminRecheckPayment, adminRefreshOrder, getAdminOrder, getAdminPayment, listAdminOrders, listAdminPayments } from "@/server/admin/orders";
import { getDashboard, getProvidersOverview, listLogs } from "@/server/admin/platform";
import { approveTopUp, rejectTopUp } from "@/server/admin/topups";
import {
  activateUser,
  adjustUserWallet,
  deleteUser,
  forceLogout,
  getUserDetail,
  listUsers,
  sendUserPasswordReset,
  setUserRole,
  suspendUser,
  updateUserProfile,
  type AdminResult,
} from "@/server/admin/users";
import { apiError, json, readJson, withAdmin } from "./http";

/**
 * Admin JSON API (session + admin role only; see withAdmin). Same services —
 * and the same audit trail — as the admin pages.
 */

const uuid = z.uuid();
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(25);
const q = z.string().trim().max(100).optional();
const result = (r: AdminResult) => (r.ok ? json({ ok: true, message: r.message }) : apiError(409, "REJECTED", r.message));
const query = (url: URL) => Object.fromEntries(url.searchParams);

function range(url: URL) {
  const r = resolveDateRange({ range: url.searchParams.get("range") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  return r.error ? null : r;
}

export const getAdminDashboard = withAdmin(async () => json(await getDashboard()));
export const getAdminProviders = withAdmin(async () => json(await getProvidersOverview()));

/* ----------------------------------------------------------------- users -- */

export const getAdminUsers = withAdmin(async (req) => {
  const p = z
    .object({
      page,
      pageSize,
      q,
      role: z.enum(["user", "admin"]).optional(),
      status: z.enum(["active", "suspended", "deleted"]).optional(),
      sort: z.enum(["newest", "oldest", "name", "balance_desc", "balance_asc"]).optional(),
    })
    .safeParse(query(req.nextUrl));
  if (!p.success) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listUsers(p.data));
});

export const getAdminUser = withAdmin<{ id: string }>(async (_req, { params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "User not found.");
  const user = await getUserDetail(params.id);
  return user ? json({ user }) : apiError(404, "NOT_FOUND", "User not found.");
});

/** { status: "suspended", reason } or { status: "active" }. */
export const postAdminUserStatus = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z
    .discriminatedUnion("status", [
      z.object({ status: z.literal("suspended"), reason: z.string().trim().min(5).max(300) }).strict(),
      z.object({ status: z.literal("active") }).strict(),
    ])
    .safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) {
    return apiError(400, "INVALID", "Body must be { status: 'suspended', reason } or { status: 'active' }.");
  }
  return result(body.data.status === "active" ? await activateUser(admin, params.id) : await suspendUser(admin, params.id, body.data.reason));
});

export const patchAdminUser = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z.object({ name: z.string().max(100), email: z.string().max(254) }).strict().safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) return apiError(400, "INVALID", "Body must be { name, email }.");
  return result(await updateUserProfile(admin, params.id, body.data));
});

export const postAdminUserPasswordReset = withAdmin<{ id: string }>(async (_req, { admin, params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "User not found.");
  return result(await sendUserPasswordReset(admin, params.id));
});

export const postAdminUserDelete = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z.object({ confirmEmail: z.string().max(254) }).strict().safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) return apiError(400, "INVALID", "Body must be { confirmEmail }.");
  return result(await deleteUser(admin, params.id, body.data.confirmEmail));
});

export const postAdminUserRole = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z.object({ role: z.enum(["user", "admin"]) }).strict().safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) return apiError(400, "INVALID", "Body must be { role: 'user' | 'admin' }.");
  return result(await setUserRole(admin, params.id, body.data.role));
});

export const postAdminUserLogout = withAdmin<{ id: string }>(async (_req, { admin, params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "User not found.");
  return result(await forceLogout(admin, params.id));
});

export const postAdminWalletAdjust = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z
    .object({
      amount: z.string().trim().min(1).max(20),
      direction: z.enum(["credit", "debit"]).optional(),
      reason: z.string().trim().min(5).max(200),
      confirm: z.literal(true),
      idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    })
    .strict()
    .safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) {
    return apiError(400, "INVALID", "Body must be { amount: '5' | '-2.50', reason, confirm: true, idempotencyKey }.");
  }
  return result(await adjustUserWallet(admin, params.id, body.data));
});

/* ------------------------------------------------------ orders & payments -- */

export const getAdminOrders = withAdmin(async (req) => {
  const p = z
    .object({ page, pageSize, q, status: z.string().max(20).optional(), serviceId: z.coerce.number().int().positive().optional(), countryId: z.coerce.number().int().positive().optional(), userId: z.uuid().optional() })
    .safeParse(query(req.nextUrl));
  const r = range(req.nextUrl);
  if (!p.success || !r) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listAdminOrders({ ...p.data, from: r.from, to: r.to }));
});

export const getAdminOrderById = withAdmin<{ id: string }>(async (_req, { params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
  const order = await getAdminOrder(params.id);
  return order ? json(order) : apiError(404, "NOT_FOUND", "Order not found.");
});

export const postAdminOrderRefresh = withAdmin<{ id: string }>(async (_req, { admin, params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
  return result(await adminRefreshOrder(admin, params.id));
});

export const postAdminOrderCancel = withAdmin<{ id: string }>(async (_req, { admin, params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Order not found.");
  return result(await adminCancelOrder(admin, params.id));
});

export const getAdminPayments = withAdmin(async (req) => {
  const p = z
    .object({ page, pageSize, q, status: z.string().max(20).optional(), review: z.enum(["1"]).optional(), userId: z.uuid().optional() })
    .safeParse(query(req.nextUrl));
  const r = range(req.nextUrl);
  if (!p.success || !r) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listAdminPayments({ ...p.data, review: p.data.review === "1", from: r.from, to: r.to }));
});

export const getAdminPaymentById = withAdmin<{ id: string }>(async (_req, { params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Payment not found.");
  const payment = await getAdminPayment(params.id);
  return payment ? json(payment) : apiError(404, "NOT_FOUND", "Payment not found.");
});

export const postAdminPaymentRecheck = withAdmin<{ id: string }>(async (_req, { admin, params }) => {
  if (!uuid.safeParse(params.id).success) return apiError(404, "NOT_FOUND", "Payment not found.");
  return result(await adminRecheckPayment(admin, params.id));
});

/* ------------------------------------------------------------------ logs -- */

export const getAdminLogs = withAdmin(async (req) => {
  const p = z.object({ page, pageSize, q, kind: z.enum(["audit", "security", "provider", "payments", "wallet"]).default("audit") }).safeParse(query(req.nextUrl));
  const r = range(req.nextUrl);
  if (!p.success || !r) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listLogs(p.data.kind, { ...p.data, from: r.from, to: r.to }));
});

/* ------------------------------------------------------- manual top-ups -- */

export const getAdminTopUps = withAdmin(async (req) => {
  const p = z
    .object({ page, pageSize, q, status: z.enum(["pending", "paid", "rejected"]).optional(), userId: z.uuid().optional() })
    .safeParse(query(req.nextUrl));
  const r = range(req.nextUrl);
  if (!p.success || !r) return apiError(400, "INVALID", "Invalid query parameters.");
  return json(await listAdminPayments({ ...p.data, provider: "manual", from: r.from, to: r.to }));
});

export const postAdminTopUpApprove = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  // No body is accepted: the amount, customer and admin all come from the server.
  const body = z.object({}).strict().safeParse((await readJson(req)) ?? {});
  if (!uuid.safeParse(params.id).success || !body.success) return apiError(400, "INVALID", "Approve takes no body.");
  return result(await approveTopUp(admin, params.id));
});

export const postAdminTopUpReject = withAdmin<{ id: string }>(async (req, { admin, params }) => {
  const body = z.object({ reason: z.string().trim().min(5).max(300) }).strict().safeParse(await readJson(req));
  if (!uuid.safeParse(params.id).success || !body.success) return apiError(400, "INVALID", "Body must be { reason } (5–300 characters).");
  return result(await rejectTopUp(admin, params.id, body.data.reason));
});
