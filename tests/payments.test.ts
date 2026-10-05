import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPaymentById, getPayments, postPayment, postPaymentWebhook, postVerifyPayment } from "@/server/api/payments";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import { PaymentProviderError } from "@/server/payments/types";
import { setProviderForTesting } from "@/server/providers/registry";
import { createApiKey } from "@/server/services/api-key.service";
import { syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { requestNumber } from "@/server/services/order.service";
import {
  createTopUp,
  getTopUp,
  handlePaymentWebhook,
  reconcilePayments,
  topUpFee,
  verifyTopUp,
} from "@/server/services/payment.service";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { getBalance } from "@/server/services/wallet.service";
import { clearSettingsCache, saveSetting } from "@/server/services/settings.service";
import { FakePaymentProvider } from "./fake-payment-provider";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

let pay: FakePaymentProvider;

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
const topUp = (userId: string, amount = "10", overrides: Partial<{ method: string; idempotencyKey: string }> = {}) =>
  createTopUp(userId, { amount, method: "card", idempotencyKey: key(), ...overrides });

async function created(userId: string, amount = "10") {
  const r = await topUp(userId, amount);
  if (!r.ok) throw new Error(r.message);
  const row = await db().payment.findUniqueOrThrow({ where: { id: r.payment.id } });
  return { item: r.payment, row, providerId: row.providerPaymentId! };
}

const credits = (paymentId: string) => db().transaction.count({ where: { paymentId, type: "DEPOSIT" } });
const webhook = (body: unknown, signature = "valid") =>
  handlePaymentWebhook("fakepay", JSON.stringify(body), new Headers({ "x-fake-signature": signature }));

function setEnv(values: Record<string, string>) {
  Object.assign(process.env, values);
  resetEnvCache();
}

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  // These tests use small top-ups; the admin-set minimum has its own tests (topup-minimum.test.ts).
  await saveSetting("topup", { minAmount: "1" });
  pay = new FakePaymentProvider();
  setPaymentProviderForTesting(pay);
});
afterEach(() => {
  setPaymentProviderForTesting(undefined);
  setEnv({ TOPUP_FEE_PERCENT: "0", TOPUP_FEE_FIXED: "0" });
});
afterAll(() => db().$disconnect());

describe("creating a top-up", () => {
  it("creates a pending payment for the validated amount and sends the provider the total", async () => {
    const u = await createUser();
    const r = await topUp(u.id, "12.50");
    expect(r).toMatchObject({ ok: true, redirectUrl: expect.stringMatching(/^https:\/\/pay\.example\.test\//) });
    if (!r.ok) return;
    expect(r.payment).toMatchObject({ status: "pending", amount: USD(12.5), fee: 0, total: USD(12.5), currency: "USD", reference: expect.stringMatching(/^TP-[A-Z0-9]{10}$/) });
    expect(pay.calls[0].args[0]).toMatchObject({ amount: USD(12.5), currency: "USD", reference: r.payment.reference, returnUrl: `http://localhost:3000/profile/top-up/${r.payment.id}` });
    expect((await getBalance(u.id)).balance).toBe(0); // nothing credited yet
  });

  it("computes fees server-side (percent rounded up to a cent, plus fixed)", async () => {
    setEnv({ TOPUP_FEE_PERCENT: "2.5", TOPUP_FEE_FIXED: "0.30" });
    expect(topUpFee(USD(10))).toBe(USD(0.55));
    expect(topUpFee(USD(3.33))).toBe(USD(0.09 + 0.3)); // 0.08325 → 0.09
    const u = await createUser();
    const r = await topUp(u.id, "10");
    expect(r).toMatchObject({ ok: true, payment: { amount: USD(10), fee: USD(0.55), total: USD(10.55) } });
    expect(pay.calls[0].args[0]).toMatchObject({ amount: USD(10.55) });
  });

  it.each(["abc", "0", "-5", "10.001", "0.50", "1000.01", "1e3", ""])("rejects the amount %j without contacting the provider", async (amount) => {
    const u = await createUser();
    expect(await topUp(u.id, amount)).toMatchObject({ ok: false, code: "INVALID" });
    expect(await db().payment.count()).toBe(0);
    expect(pay.calls).toHaveLength(0);
  });

  it("accepts the limits themselves", async () => {
    const u = await createUser();
    expect(await topUp(u.id, "1")).toMatchObject({ ok: true });
    expect(await topUp(u.id, "1000")).toMatchObject({ ok: true });
  });

  it("rejects unknown payment methods", async () => {
    const u = await createUser();
    expect(await topUp(u.id, "10", { method: "bitcoin" })).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("reports top-ups as unavailable when no provider is configured", async () => {
    setPaymentProviderForTesting(null);
    const u = await createUser();
    expect(await topUp(u.id)).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db().payment.count()).toBe(0);
  });

  it("a repeated submit with the same key returns the same payment", async () => {
    const u = await createUser();
    const k = key();
    const [a, b, c] = await Promise.all([topUp(u.id, "10", { idempotencyKey: k }), topUp(u.id, "10", { idempotencyKey: k }), topUp(u.id, "10", { idempotencyKey: k })]);
    expect(a.ok && b.ok && c.ok && a.payment.id === b.payment.id && b.payment.id === c.payment.id).toBe(true);
    expect(await db().payment.count()).toBe(1);
    expect(pay.calls.filter((x) => x.method === "createPayment")).toHaveLength(1);
  });

  it("limits unfinished payments per user", async () => {
    const u = await createUser();
    for (let i = 0; i < 5; i++) expect(await topUp(u.id)).toMatchObject({ ok: true });
    expect(await topUp(u.id)).toMatchObject({ ok: false, code: "TOO_MANY_PENDING" });
  });

  it("marks the payment failed when the provider refuses, and a resubmit doesn't succeed", async () => {
    const u = await createUser();
    pay.createError = new PaymentProviderError("BAD_REQUEST", "nope", "fakepay");
    const k = key();
    expect(await topUp(u.id, "10", { idempotencyKey: k })).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    expect((await db().payment.findFirstOrThrow()).status).toBe("FAILED");
    pay.createError = null;
    expect(await topUp(u.id, "10", { idempotencyKey: k })).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    expect(await topUp(u.id, "10")).toMatchObject({ ok: true }); // a new attempt works
  });

  it("keeps an unconfirmed create open and recovers it by reference", async () => {
    const u = await createUser();
    pay.createError = new PaymentProviderError("TIMEOUT", "timeout", "fakepay");
    pay.createDespiteError = true;
    expect(await topUp(u.id)).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    const row = await db().payment.findFirstOrThrow();
    expect(row).toMatchObject({ status: "PENDING", providerPaymentId: null, failureReason: "CREATE_UNCONFIRMED" });
    // The customer can't pay it (no checkout), but reconciliation links it; if it is paid it is credited.
    const [providerId] = [...pay.payments.keys()];
    pay.set(providerId, { status: "paid" });
    await reconcilePayments();
    expect(await db().payment.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ status: "PAID", providerPaymentId: providerId });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });
});

describe("verification and crediting", () => {
  it("credits exactly once, the amount (not the fee), after the provider confirms", async () => {
    setEnv({ TOPUP_FEE_PERCENT: "2.5", TOPUP_FEE_FIXED: "0" });
    const u = await createUser();
    const p = await created(u.id, "10");
    pay.set(p.providerId, { status: "paid" });
    const r = await verifyTopUp(u.id, p.item.id);
    expect(r).toMatchObject({ ok: true, payment: { status: "paid", paidAt: expect.any(String) } });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
    const credit = await db().transaction.findFirstOrThrow({ where: { paymentId: p.item.id } });
    expect(credit).toMatchObject({ type: "DEPOSIT", reference: `payment:${p.item.id}:credit`, userId: u.id, currency: "USD" });
    expect(credit.amount.toString()).toBe("10");
    // Every other path sees it as already processed.
    await verifyTopUp(u.id, p.item.id);
    await getTopUp(u.id, p.item.id);
    await reconcilePayments();
    await webhook({ id: "evt_1", paymentId: p.providerId });
    expect(await credits(p.item.id)).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });

  it("concurrent confirmations still credit once", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    await Promise.all([
      verifyTopUp(u.id, p.item.id),
      verifyTopUp(u.id, p.item.id),
      webhook({ id: "evt_a", paymentId: p.providerId }),
      webhook({ id: "evt_b", paymentId: p.providerId }),
      reconcilePayments(),
    ]);
    expect(await credits(p.item.id)).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });

  it("does nothing while the provider still reports pending", async () => {
    const u = await createUser();
    const p = await created(u.id);
    expect(await verifyTopUp(u.id, p.item.id)).toMatchObject({ ok: true, payment: { status: "pending" } });
    expect((await getBalance(u.id)).balance).toBe(0);
  });

  it("marks failed payments without crediting, but credits a late successful payment", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "failed" });
    expect(await verifyTopUp(u.id, p.item.id)).toMatchObject({ ok: true, payment: { status: "failed" } });
    expect((await getBalance(u.id)).balance).toBe(0);
    pay.set(p.providerId, { status: "paid" });
    await reconcilePayments();
    expect(await getTopUp(u.id, p.item.id)).toMatchObject({ status: "paid" });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });

  it("expires payments: when the provider says so, or long after the deadline", async () => {
    const u = await createUser();
    const a = await created(u.id);
    pay.set(a.providerId, { status: "expired" });
    expect(await verifyTopUp(u.id, a.item.id)).toMatchObject({ payment: { status: "expired", checkoutUrl: null } });

    const b = await created(u.id);
    await db().payment.update({ where: { id: b.item.id }, data: { expiresAt: new Date(Date.now() - 60 * 60_000) } });
    await reconcilePayments();
    expect(await getTopUp(u.id, b.item.id)).toMatchObject({ status: "expired" });
    expect((await getBalance(u.id)).balance).toBe(0);
  });

  it.each([
    ["amount", { amount: USD(9.99) }],
    ["currency", { currency: "EUR" }],
    ["reference", { reference: "TP-SOMEONEELS" }],
  ])("never credits when the provider's %s doesn't match — flags it for review", async (_what, patch) => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid", ...patch });
    await verifyTopUp(u.id, p.item.id);
    expect((await getBalance(u.id)).balance).toBe(0);
    expect(await db().payment.findUniqueOrThrow({ where: { id: p.item.id } })).toMatchObject({ status: "PENDING", needsReview: true });
  });

  it("flags a refund after crediting for staff review instead of debiting automatically", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    await verifyTopUp(u.id, p.item.id);
    pay.set(p.providerId, { status: "refunded" });
    await reconcilePayments(); // polling treats paid payments as final…
    expect((await db().payment.findUniqueOrThrow({ where: { id: p.item.id } })).status).toBe("PAID");
    await webhook({ id: "evt_refund", paymentId: p.providerId }); // …the provider's notification is checked
    expect(await db().payment.findUniqueOrThrow({ where: { id: p.item.id } })).toMatchObject({ status: "REFUNDED", needsReview: true });
    expect((await getBalance(u.id)).balance).toBe(USD(10)); // no automatic debit
    expect(await credits(p.item.id)).toBe(1);
  });

  it("keeps a payment open when the provider can't be reached", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.getError = new PaymentProviderError("UNAVAILABLE", "down", "fakepay");
    expect(await verifyTopUp(u.id, p.item.id)).toMatchObject({ ok: true, payment: { status: "pending" } });
    expect(await reconcilePayments()).toMatchObject({ unreachable: 1 });
  });

  it("users can't see, verify or credit each other's payments", async () => {
    const owner = await createUser();
    const other = await createUser();
    const p = await created(owner.id);
    pay.set(p.providerId, { status: "paid" });
    expect(await getTopUp(other.id, p.item.id)).toBeNull();
    expect(await verifyTopUp(other.id, p.item.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect((await getBalance(other.id)).balance).toBe(0);
  });
});

describe("webhooks", () => {
  it("processes a valid webhook by re-checking the provider, and ignores duplicates", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    expect(await webhook({ id: "evt_1", paymentId: p.providerId })).toEqual({ status: 200, body: { received: true } });
    expect(await webhook({ id: "evt_1", paymentId: p.providerId })).toEqual({ status: 200, body: { received: true, duplicate: true } });
    expect(await credits(p.item.id)).toBe(1);
    expect(pay.calls.some((c) => c.method === "getPayment")).toBe(true);
  });

  it("does not credit on a webhook alone: the provider's state decides", async () => {
    const u = await createUser();
    const p = await created(u.id); // still pending at the provider
    expect(await webhook({ id: "evt_fake_paid", paymentId: p.providerId })).toMatchObject({ status: 200 });
    expect((await getBalance(u.id)).balance).toBe(0);
  });

  it("rejects bad signatures and malformed payloads", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    expect(await webhook({ id: "evt_1", paymentId: p.providerId }, "forged")).toMatchObject({ status: 401 });
    expect(await handlePaymentWebhook("fakepay", "{not json", new Headers({ "x-fake-signature": "valid" }))).toMatchObject({ status: 400 });
    expect(await handlePaymentWebhook("otherpay", "{}", new Headers())).toMatchObject({ status: 404 });
    expect((await getBalance(u.id)).balance).toBe(0);
    expect(await db().paymentEvent.count()).toBe(0);
  });

  it("acknowledges events for unknown payments", async () => {
    expect(await webhook({ id: "evt_x", paymentId: "fp_999" })).toMatchObject({ status: 200 });
  });

  it("asks for redelivery when the provider can't be reached, then processes the retry", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    pay.getError = new PaymentProviderError("TIMEOUT", "slow", "fakepay");
    expect(await webhook({ id: "evt_r", paymentId: p.providerId })).toMatchObject({ status: 503 });
    expect((await getBalance(u.id)).balance).toBe(0);
    pay.getError = null;
    expect(await webhook({ id: "evt_r", paymentId: p.providerId })).toEqual({ status: 200, body: { received: true } });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });
});

describe("webhook route", () => {
  it("accepts a verified webhook through the route handler and credits once", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    const body = JSON.stringify({ id: "evt_route_1", paymentId: p.providerId });
    const send = (signature: string) =>
      postPaymentWebhook(
        new NextRequest("http://localhost:3000/api/payments/webhook/fakepay", { method: "POST", headers: { "content-type": "application/json", "x-fake-signature": signature }, body }),
        { params: Promise.resolve({ provider: "fakepay" }) },
      );
    expect((await send("forged")).status).toBe(401);
    expect((await send("valid")).status).toBe(200);
    expect((await send("valid")).status).toBe(200); // redelivery
    expect(await credits(p.item.id)).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(10));
  });
});

describe("payments API", () => {
  type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
  async function call(handler: unknown, opts: { key?: string; method?: string; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
    const req = new NextRequest("http://localhost:3000/api/payments", {
      method: opts.method ?? "GET",
      headers: { ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}), ...(opts.body ? { "content-type": "application/json" } : {}), ...opts.headers },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("requires authentication", async () => {
    expect((await call(getPayments)).status).toBe(401);
    expect((await call(postPayment, { method: "POST", body: { amount: "10", method: "card" } })).status).toBe(401);
  });

  it("creates for the key's owner only and ignores user id / status / total in the body", async () => {
    const u = await createUser();
    const victim = await createUser();
    const { key: apiKey } = await createApiKey(u.id);
    const res = await call(postPayment, {
      key: apiKey,
      method: "POST",
      body: { amount: "10", method: "card", userId: victim.id, status: "PAID", total: 1, fee: -5 },
      headers: { "idempotency-key": "pay-test-key-00000001" },
    });
    expect(res.status).toBe(201);
    const payment = res.body.payment as { id: string; status: string; total: number };
    expect(payment).toMatchObject({ status: "pending", total: USD(10) });
    expect((await db().payment.findUniqueOrThrow({ where: { id: payment.id } })).userId).toBe(u.id);
    expect((await getBalance(u.id)).balance).toBe(0);
    expect((await getBalance(victim.id)).balance).toBe(0);
  });

  it("requires an idempotency key and a valid body", async () => {
    const u = await createUser();
    const { key: apiKey } = await createApiKey(u.id);
    expect((await call(postPayment, { key: apiKey, method: "POST", body: { amount: "10", method: "card" } })).status).toBe(400);
    expect((await call(postPayment, { key: apiKey, method: "POST", body: { amount: "10" }, headers: { "idempotency-key": "pay-test-key-00000002" } })).status).toBe(400);
    expect((await call(postPayment, { key: apiKey, method: "POST", body: { amount: "0.001", method: "card" }, headers: { "idempotency-key": "pay-test-key-00000003" } })).status).toBe(400);
  });

  it("hides other users' payments (404) and never exposes secrets", async () => {
    const owner = await createUser();
    const other = await createUser();
    const p = await created(owner.id);
    const otherKey = (await createApiKey(other.id)).key;
    expect((await call(getPaymentById, { key: otherKey, params: { id: p.item.id } })).status).toBe(404);
    expect((await call(postVerifyPayment, { key: otherKey, method: "POST", params: { id: p.item.id } })).status).toBe(404);
    const ownerKey = (await createApiKey(owner.id)).key;
    const mine = await call(getPaymentById, { key: ownerKey, params: { id: p.item.id } });
    expect(mine.status).toBe(200);
    expect(Object.keys(mine.body.payment as object)).not.toContain("providerPaymentId");
    expect(Object.keys(mine.body.payment as object)).not.toContain("userId");
  });
});

describe("database guards", () => {
  it("a paid payment can't be moved back or have its amounts changed", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    await verifyTopUp(u.id, p.item.id);
    await expect(db().payment.update({ where: { id: p.item.id }, data: { status: "PENDING" } })).rejects.toThrow();
    await expect(db().payment.update({ where: { id: p.item.id }, data: { amount: "999.0000", total: "999.0000" } })).rejects.toThrow();
    await expect(db().payment.delete({ where: { id: p.item.id } })).rejects.toThrow();
  });

  it("the ledger won't accept a second credit for the same payment", async () => {
    const u = await createUser();
    const p = await created(u.id);
    pay.set(p.providerId, { status: "paid" });
    await verifyTopUp(u.id, p.item.id);
    await db().payment.update({ where: { id: p.item.id }, data: { needsReview: false } });
    const credit = await db().transaction.findFirstOrThrow({ where: { paymentId: p.item.id } });
    await expect(db().transaction.create({ data: { ...credit, id: undefined, createdAt: undefined, metadata: undefined } })).rejects.toThrow();
  });
});

describe("marketplace after a deposit", () => {
  it("the deposited balance buys a number through the normal order flow", async () => {
    const sms = new FakeProvider();
    setProviderForTesting(sms);
    invalidateProviderBalance();
    await syncCatalog();
    const usa = await db().country.findFirstOrThrow({ where: { providerCode: "12" } });

    const u = await createUser();
    const p = await created(u.id, "5");
    pay.set(p.providerId, { status: "paid" });
    await verifyTopUp(u.id, p.item.id);

    const order = await requestNumber(u.id, { service: "tg", country: String(usa.id), price: customerPrice(3500), idempotencyKey: key() });
    expect(order).toMatchObject({ ok: true, order: { status: "active" } });
    expect((await getBalance(u.id)).balance).toBe(USD(5) - customerPrice(3500));
    const ledger = await db().transaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
    expect(ledger.map((t) => t.type)).toEqual(["DEPOSIT", "PURCHASE"]);
    setProviderForTesting(undefined);
  });
});
