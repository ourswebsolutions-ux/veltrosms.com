import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { audit } from "@/server/admin/audit";
import type { AdminActor } from "@/server/admin/guard";
import { adminCancelOrder, adminRecheckPayment, getAdminOrder, listAdminOrders, listAdminPayments, resolvePaymentReview } from "@/server/admin/orders";
import { getDashboard, getProvidersOverview, listLogs, providerStatus, saveMaintenance, savePricing, setCatalogItemActive } from "@/server/admin/platform";
import { adjustUserWallet, forceLogout, getUserDetail, listUsers, setUserRole, setUserStatus } from "@/server/admin/users";
import { getAdminUser, getAdminUsers, postAdminUserRole, postAdminUserStatus, postAdminWalletAdjust } from "@/server/api/admin";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import { setProviderForTesting } from "@/server/providers/registry";
import { createApiKey } from "@/server/services/api-key.service";
import * as auth from "@/server/services/auth.service";
import { listServices, quote, syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { requestNumber } from "@/server/services/order.service";
import { createTopUp } from "@/server/services/payment.service";
import { setPricingRules } from "@/server/services/pricing-rules";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { clearSettingsCache } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakePaymentProvider } from "./fake-payment-provider";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
let sms: FakeProvider;
let usaId: string;

async function makeAdmin(email?: string) {
  const u = await createUser(email ? { email } : {});
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  const actor: AdminActor = { id: u.id, email: u.email, name: u.name, sessionId: (await validateSessionToken(s.token))!.sessionId };
  return { user: u, token: s.token, actor };
}

async function signedInUser() {
  const u = await createUser();
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  return { user: u, token: s.token };
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function call(handler: unknown, opts: { token?: string; apiKey?: string; method?: string; body?: unknown; params?: Record<string, string>; origin?: string | null; url?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.cookie = `rocksms_session=${opts.token}`;
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.origin !== null && opts.method && opts.method !== "GET") headers.origin = opts.origin ?? "http://localhost:3000";
  const req = new NextRequest(opts.url ?? "http://localhost:3000/api/admin/x", { method: opts.method ?? "GET", headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  setPricingRules(null);
  sms = new FakeProvider();
  setProviderForTesting(sms);
  invalidateProviderBalance();
  await syncCatalog();
  usaId = String((await db().country.findFirstOrThrow({ where: { providerCode: "12" } })).id);
});
afterEach(() => {
  setProviderForTesting(undefined);
  setPaymentProviderForTesting(undefined);
  clearSettingsCache();
  setPricingRules(null);
});
afterAll(() => db().$disconnect());

describe("admin API access", () => {
  it("rejects anonymous (401), normal users (403) and API keys (403)", async () => {
    const user = await signedInUser();
    const apiKey = (await createApiKey(user.user.id)).key;
    expect((await call(getAdminUsers)).status).toBe(401);
    expect((await call(getAdminUsers, { token: user.token })).status).toBe(403);
    expect((await call(getAdminUsers, { apiKey })).status).toBe(403);
    const admin = await makeAdmin();
    const adminKey = (await createApiKey(admin.user.id)).key;
    expect((await call(getAdminUsers, { apiKey: adminKey })).status).toBe(403); // even an admin's API key
    expect((await call(getAdminUsers, { token: admin.token })).status).toBe(200);
  });

  it("a normal user can't make themselves admin or credit themselves", async () => {
    const user = await signedInUser();
    const r1 = await call(postAdminUserRole, { token: user.token, method: "POST", body: { role: "admin" }, params: { id: user.user.id } });
    const r2 = await call(postAdminWalletAdjust, { token: user.token, method: "POST", body: { amount: "100", reason: "free money", confirm: true, idempotencyKey: key() }, params: { id: user.user.id } });
    expect([r1.status, r2.status]).toEqual([403, 403]);
    expect((await db().user.findUniqueOrThrow({ where: { id: user.user.id } })).role).toBe("USER");
    expect((await getBalance(user.user.id)).balance).toBe(0);
  });

  it("rejects cross-site writes and extra (mass-assignment) fields", async () => {
    const admin = await makeAdmin();
    const target = await createUser();
    expect((await call(postAdminUserStatus, { token: admin.token, method: "POST", body: { status: "suspended", reason: "Test suspension reason" }, params: { id: target.id }, origin: "https://evil.example" })).status).toBe(403);
    expect((await call(postAdminUserStatus, { token: admin.token, method: "POST", body: { status: "suspended", reason: "Test suspension reason", role: "admin" }, params: { id: target.id } })).status).toBe(400);
    expect((await call(postAdminUserStatus, { token: admin.token, method: "POST", body: { status: "suspended", reason: "Test suspension reason" }, params: { id: "not-a-uuid" } })).status).toBe(400);
    const ok = await call(postAdminUserStatus, { token: admin.token, method: "POST", body: { status: "suspended", reason: "Test suspension reason" }, params: { id: target.id } });
    expect(ok.status).toBe(200);
  });

  it("returns user details without secrets", async () => {
    const admin = await makeAdmin();
    const target = await createUser();
    await createApiKey(target.id);
    const r = await call(getAdminUser, { token: admin.token, params: { id: target.id } });
    const text = JSON.stringify(r.body);
    expect(r.status).toBe(200);
    expect(text).not.toMatch(/passwordHash|apiKeyHash|tokenHash|scrypt/);
    expect((r.body.user as { hasApiKey: boolean }).hasApiKey).toBe(true);
  });
});

describe("user management", () => {
  it("searches and filters users", async () => {
    await makeAdmin("boss@example.com");
    const u = await createUser({ email: "findme@example.com", name: "Grace Hopper" });
    await createUser({ email: "other@example.com" });
    expect((await listUsers({ q: "findme" })).items.map((x) => x.id)).toEqual([u.id]);
    expect((await listUsers({ q: "Hopper" })).items.map((x) => x.id)).toEqual([u.id]);
    expect((await listUsers({ q: u.id.slice(0, 8) })).items.map((x) => x.id)).toEqual([u.id]);
    expect((await listUsers({ role: "admin" })).total).toBe(1);
    expect((await listUsers({ pageSize: 1, page: 2 })).items).toHaveLength(1);
  });

  it("suspending logs the user out immediately and is audited; self/last-admin changes are refused", async () => {
    const admin = await makeAdmin();
    const target = await signedInUser();
    expect(await setUserStatus(admin.actor, target.user.id, "suspended", "Chargeback investigation")).toMatchObject({ ok: true });
    expect(await validateSessionToken(target.token)).toBeNull();
    expect(await auth.login({ email: target.user.email, password: "Test-password-1234", remember: false }, { ip: "unknown", userAgent: "t" })).toMatchObject({
      ok: false,
      code: "suspended",
    });
    expect(await setUserStatus(admin.actor, admin.user.id, "suspended", "Self suspension attempt")).toMatchObject({ ok: false });
    expect(await setUserRole(admin.actor, admin.user.id, "user")).toMatchObject({ ok: false });
    const other = await makeAdmin();
    expect(await setUserRole(other.actor, admin.user.id, "user")).toMatchObject({ ok: true });
    // `other` is now the only admin: nobody can demote them.
    const third = await makeAdmin();
    await setUserRole(third.actor, other.user.id, "user");
    expect(await setUserRole(other.actor, third.user.id, "user")).toMatchObject({ ok: false });
    const logs = await db().auditLog.findMany({ where: { action: { in: ["user.suspend", "user.suspended", "user.role"] } } });
    expect(logs.some((l) => !l.success)).toBe(true);
    expect(logs.every((l) => l.actorId)).toBe(true);
  });

  it("force logout ends the user's sessions", async () => {
    const admin = await makeAdmin();
    const target = await signedInUser();
    expect(await forceLogout(admin.actor, target.user.id)).toMatchObject({ ok: true });
    expect(await validateSessionToken(target.token)).toBeNull();
  });

  it("details aggregate the ledger and orders", async () => {
    const target = await createUser();
    await creditWallet({ userId: target.id, amount: USD(5), type: "DEPOSIT", reference: "d1" });
    await requestNumber(target.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
    const d = await getUserDetail(target.id);
    expect(d).toMatchObject({ balance: USD(5) - customerPrice(3500), totals: { deposits: USD(5), purchases: -customerPrice(3500) }, orderCounts: { total: 1, active: 1 } });
  });
});

describe("wallet adjustments", () => {
  it("credit and debit through the ledger with the admin recorded, once per form", async () => {
    const admin = await makeAdmin();
    const target = await createUser();
    const k = key();
    expect(await adjustUserWallet(admin.actor, target.id, { amount: "5", reason: "WhatsApp top-up #1", idempotencyKey: k })).toMatchObject({ ok: true });
    expect(await adjustUserWallet(admin.actor, target.id, { amount: "5", reason: "WhatsApp top-up #1", idempotencyKey: k })).toMatchObject({ ok: true, message: expect.stringMatching(/already applied/) });
    expect((await getBalance(target.id)).balance).toBe(USD(5));
    expect(await adjustUserWallet(admin.actor, target.id, { amount: "-2.50", reason: "Correction for test", idempotencyKey: key() })).toMatchObject({ ok: true });
    expect((await getBalance(target.id)).balance).toBe(USD(2.5));

    const rows = await db().transaction.findMany({ where: { userId: target.id, type: "ADJUSTMENT" }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows[0].description).toBe("Manual adjustment — WhatsApp top-up #1");
    expect((rows[0].metadata as { actor: string }).actor).toBe(admin.user.id);
    expect(await db().auditLog.count({ where: { action: { in: ["wallet.credited", "wallet.debited"] }, success: true } })).toBe(2);
  });

  it("never goes negative and validates amount and reason", async () => {
    const admin = await makeAdmin();
    const target = await createUser();
    expect(await adjustUserWallet(admin.actor, target.id, { amount: "-1", reason: "too much debit", idempotencyKey: key() })).toMatchObject({ ok: false, message: expect.stringMatching(/negative/) });
    for (const amount of ["0", "abc", "1.00001", "20000"]) {
      expect(await adjustUserWallet(admin.actor, target.id, { amount, reason: "valid reason", idempotencyKey: key() })).toMatchObject({ ok: false });
    }
    expect(await adjustUserWallet(admin.actor, target.id, { amount: "1", reason: "no", idempotencyKey: key() })).toMatchObject({ ok: false });
    expect((await getBalance(target.id)).balance).toBe(0);
    expect(await db().auditLog.count({ where: { action: "wallet.debit", success: false } })).toBe(1);
  });

  it("the API requires explicit confirmation", async () => {
    const admin = await makeAdmin();
    const target = await createUser();
    const base = { amount: "3", reason: "API adjustment", idempotencyKey: key() };
    expect((await call(postAdminWalletAdjust, { token: admin.token, method: "POST", body: base, params: { id: target.id } })).status).toBe(400);
    expect((await call(postAdminWalletAdjust, { token: admin.token, method: "POST", body: { ...base, confirm: true }, params: { id: target.id } })).status).toBe(200);
    expect((await getBalance(target.id)).balance).toBe(USD(3));
  });
});

describe("orders and payments", () => {
  it("lists, filters and shows orders with provider calls (no raw payloads)", async () => {
    const buyer = await createUser({ email: "buyer@example.com" });
    await creditWallet({ userId: buyer.id, amount: USD(5), type: "DEPOSIT", reference: "d" });
    const r = await requestNumber(buyer.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
    if (!r.ok) throw new Error(r.message);
    expect((await listAdminOrders({ q: "buyer@" })).total).toBe(1);
    expect((await listAdminOrders({ status: "completed" })).total).toBe(0);
    expect((await listAdminOrders({ status: "active", countryId: Number(usaId) })).total).toBe(1);
    const detail = await getAdminOrder(r.order.id);
    expect(detail?.order.providerActivationId).toBeTruthy();
    expect(JSON.stringify(detail)).not.toMatch(/"response"|"params"/);
  });

  it("admin cancel refunds exactly once", async () => {
    const admin = await makeAdmin();
    const buyer = await createUser();
    await creditWallet({ userId: buyer.id, amount: USD(5), type: "DEPOSIT", reference: "d" });
    const r = await requestNumber(buyer.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
    if (!r.ok) throw new Error(r.message);
    expect(await adminCancelOrder(admin.actor, r.order.id)).toMatchObject({ ok: true });
    expect(await adminCancelOrder(admin.actor, r.order.id)).toMatchObject({ ok: false });
    expect(await db().transaction.count({ where: { orderId: r.order.id, type: "REFUND" } })).toBe(1);
    expect((await getBalance(buyer.id)).balance).toBe(USD(5));
  });

  it("payment re-check credits only via the provider's state; reviews close without moving money", async () => {
    const pay = new FakePaymentProvider();
    setPaymentProviderForTesting(pay);
    const admin = await makeAdmin();
    const buyer = await createUser();
    const t = await createTopUp(buyer.id, { amount: "10", method: "card", idempotencyKey: key() });
    if (!t.ok) throw new Error(t.message);
    const row = await db().payment.findUniqueOrThrow({ where: { id: t.payment.id } });
    expect(await adminRecheckPayment(admin.actor, row.id)).toMatchObject({ ok: true });
    expect((await getBalance(buyer.id)).balance).toBe(0);
    pay.set(row.providerPaymentId!, { status: "paid", amount: USD(9) }); // mismatching amount
    await adminRecheckPayment(admin.actor, row.id);
    expect((await listAdminPayments({ review: true })).total).toBe(1);
    expect((await getBalance(buyer.id)).balance).toBe(0);
    expect(await resolvePaymentReview(admin.actor, row.id, "no")).toMatchObject({ ok: false });
    expect(await resolvePaymentReview(admin.actor, row.id, "Checked provider: partial payment, refunded there.")).toMatchObject({ ok: true });
    expect((await listAdminPayments({ review: true })).total).toBe(0);
    expect((await getBalance(buyer.id)).balance).toBe(0);
  });
});

describe("providers, pricing, catalog, maintenance", () => {
  it("never exposes provider or payment secrets", async () => {
    const e = process.env;
    Object.assign(process.env, { GRIZZLY_API_KEY: "super-secret-grizzly-key-1234" });
    const { resetEnvCache } = await import("@/server/env");
    resetEnvCache();
    try {
      const o = await getProvidersOverview();
      expect(JSON.stringify(o)).not.toContain("super-secret-grizzly-key-1234");
      expect(o.sms.apiKey).toBe("Set (hidden)");
    } finally {
      delete e.GRIZZLY_API_KEY;
      resetEnvCache();
    }
  });

  it("maps provider health to honest statuses", () => {
    expect(providerStatus({ configured: true, reachable: true, errorCategory: null, balance: 100 })).toBe("online");
    expect(providerStatus({ configured: true, reachable: true, errorCategory: null, balance: 0 })).toBe("no_balance");
    expect(providerStatus({ configured: true, reachable: false, errorCategory: "UNAUTHORIZED", balance: null })).toBe("auth_failed");
    expect(providerStatus({ configured: true, reachable: false, errorCategory: "TIMEOUT", balance: null })).toBe("timeout");
    expect(providerStatus({ configured: false, reachable: false, errorCategory: "NOT_CONFIGURED", balance: null })).toBe("not_configured");
  });

  it("pricing changes reprice stored prices and quotes, and are audited", async () => {
    const admin = await makeAdmin();
    expect(await savePricing(admin.actor, { markupPercent: "900", minMargin: "0.01" })).toMatchObject({ ok: false });
    expect(await savePricing(admin.actor, { markupPercent: "50", minMargin: "0.01" })).toMatchObject({ ok: true });
    const expected = customerPrice(3500, { markupPercent: "50", minMargin: "0.01" });
    expect(expected).not.toBe(customerPrice(3500, { markupPercent: "20", minMargin: "0.01" }));
    const svc = await db().service.findFirstOrThrow({ where: { providerCode: "tg" } });
    const stored = await db().price.findFirstOrThrow({ where: { serviceId: svc.id, countryId: Number(usaId) } });
    expect(Math.round(Number(stored.price) * 10_000)).toBe(expected);
    const q = await quote("tg", usaId, expected);
    expect(q?.match?.price).toBe(expected);
    expect(await db().auditLog.count({ where: { action: "pricing.update" } })).toBe(1);
  });

  it("local catalog switches hide items from customers", async () => {
    const admin = await makeAdmin();
    const wa = await db().service.findFirstOrThrow({ where: { providerCode: "wa" } });
    await setCatalogItemActive(admin.actor, "service", wa.id, false);
    expect((await listServices()).map((s) => s.slug)).not.toContain(wa.slug);
    await setCatalogItemActive(admin.actor, "service", wa.id, true);
    expect((await listServices()).map((s) => s.slug)).toContain(wa.slug);
  });

  it("maintenance mode pauses purchases and top-ups, not browsing", async () => {
    const admin = await makeAdmin();
    const buyer = await createUser();
    await creditWallet({ userId: buyer.id, amount: USD(5), type: "DEPOSIT", reference: "d" });
    setPaymentProviderForTesting(new FakePaymentProvider());
    await saveMaintenance(admin.actor, { enabled: true, message: "Back at 18:00" });
    expect(await requestNumber(buyer.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() })).toMatchObject({ ok: false, code: "UNAVAILABLE", message: "Back at 18:00" });
    expect(await createTopUp(buyer.id, { amount: "5", method: "card", idempotencyKey: key() })).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect((await listServices()).length).toBeGreaterThan(0);
    await saveMaintenance(admin.actor, { enabled: false, message: "" });
    expect(await requestNumber(buyer.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() })).toMatchObject({ ok: true });
  });
});

describe("dashboard, logs and audit", () => {
  it("dashboard figures come from the database", async () => {
    await makeAdmin();
    const buyer = await createUser();
    await creditWallet({ userId: buyer.id, amount: USD(5), type: "DEPOSIT", reference: "d" });
    await requestNumber(buyer.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
    const d = await getDashboard();
    expect(d).toMatchObject({ users: { total: 2, active: 2, suspended: 0 }, orders: { total: 1, pending: 1 }, money: { deposits: USD(5), purchases: customerPrice(3500) } });
    expect(d.byDay).toHaveLength(14);
  });

  it("logs are searchable and paginated; security events are recorded without secrets", async () => {
    const admin = await makeAdmin();
    const target = await createUser({ email: "victim@example.com" });
    for (let i = 0; i < 3; i++) await adjustUserWallet(admin.actor, target.id, { amount: "1", reason: `Adjustment number ${i}`, idempotencyKey: key() });
    await auth.login({ email: "victim@example.com", password: "Wrong-password-000", remember: false }, { ip: "203.0.113.9", userAgent: "t" });

    const auditPage = await listLogs("audit", { q: "wallet.credited", pageSize: 2 });
    expect(auditPage).toMatchObject({ total: 3, pageSize: 2 });
    expect(auditPage.items).toHaveLength(2);
    expect((await listLogs("audit", { q: "user.role" })).total).toBe(0);
    const security = await listLogs("security", {});
    expect(security.items[0]).toMatchObject({ title: "login failed", subject: "victim@example.com" });
    expect(JSON.stringify(security)).not.toContain("Wrong-password-000");
    expect((await listLogs("wallet", { q: "victim" })).total).toBe(3);
  });

  it("the audit trail is append-only and never stores secrets", async () => {
    const admin = await makeAdmin();
    await audit(admin.actor, "test.action", { type: "user", id: admin.user.id }, true, { password: "hunter2", nested: { apiKey: "k", ok: "yes" }, token: "t" });
    const row = await db().auditLog.findFirstOrThrow({ where: { action: "test.action" } });
    expect(JSON.stringify(row.metadata)).not.toMatch(/hunter2|apiKey|token/);
    expect(row.metadata).toMatchObject({ nested: { ok: "yes" } });
    await expect(db().auditLog.update({ where: { id: row.id }, data: { success: false } })).rejects.toThrow();
    await expect(db().auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });
});
