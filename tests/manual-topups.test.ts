import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { approveTopUp, rejectTopUp } from "@/server/admin/topups";
import type { AdminActor } from "@/server/admin/guard";
import { postAdminTopUpApprove, postAdminTopUpReject } from "@/server/api/admin";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { ManualPaymentProvider } from "@/server/payments/manual/manual-provider";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import {
  approveManualTopUp,
  createManualTopUp,
  createTopUp,
  getTopUp,
  getTopUpOptions,
  listTopUps,
  normalizeTransactionId,
  reconcilePayments,
} from "@/server/services/payment.service";
import { clearSettingsCache, saveSetting, whatsappDigits } from "@/server/services/settings.service";
import { getBalance } from "@/server/services/wallet.service";
import { createUser, resetDatabase, USD } from "./helpers";

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
let tidCounter = 1000;
const tid = () => `TID${Date.now()}${tidCounter++}`;

const request = (userId: string, over: Partial<{ amount: string; method: string; transactionId: string; note: string; idempotencyKey: string }> = {}) =>
  createManualTopUp(userId, { amount: "10", method: "easypaisa", transactionId: tid(), idempotencyKey: key(), ...over });

async function admin() {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  const actor: AdminActor = { id: u.id, email: u.email, name: u.name, sessionId: (await validateSessionToken(s.token))!.sessionId };
  return { user: u, token: s.token, actor };
}

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  setPaymentProviderForTesting(new ManualPaymentProvider());
});
afterEach(() => {
  setPaymentProviderForTesting(undefined);
  clearSettingsCache();
});
afterAll(() => db().$disconnect());

describe("manual payment details", () => {
  it("shows the configured Easypaisa / JazzCash account and a WhatsApp link", async () => {
    const o = await getTopUpOptions();
    expect(o).toMatchObject({
      available: true,
      flow: "manual",
      manual: { accountName: "Muhammad Usman", accountNumber: "03246623395", whatsapp: "03246623395", whatsappDigits: "923246623395" },
    });
    expect(o.methods.map((m) => m.id)).toEqual(["easypaisa", "jazzcash"]);
  });

  it("normalizes WhatsApp numbers and transaction IDs", () => {
    expect(whatsappDigits("0324 6623395")).toBe("923246623395");
    expect(whatsappDigits("+92 324 6623395")).toBe("923246623395");
    expect(whatsappDigits("12")).toBeNull();
    expect(normalizeTransactionId(" ab12 3456 ")).toBe("AB123456");
    expect(normalizeTransactionId("12")).toBeNull();
    expect(normalizeTransactionId("<script>")).toBeNull();
  });
});

describe("customer requests", () => {
  it("records a pending request and credits nothing", async () => {
    const u = await createUser();
    const r = await request(u.id, { amount: "12.50", method: "jazzcash", note: "sent from 0300…" });
    expect(r).toMatchObject({ ok: true, redirectUrl: null, payment: { status: "pending", manual: true, amount: USD(12.5), fee: 0, total: USD(12.5), methodLabel: "JazzCash" } });
    expect((await getBalance(u.id)).balance).toBe(0);
    expect(await db().transaction.count()).toBe(0);
    expect(await db().auditLog.count({ where: { action: "topup.created" } })).toBe(1);
    // Manual requests are never polled or expired automatically.
    await reconcilePayments();
    if (r.ok) expect(await getTopUp(u.id, r.payment.id)).toMatchObject({ status: "pending" });
  });

  it("validates amount, method and transaction ID", async () => {
    const u = await createUser();
    expect(await request(u.id, { amount: "0.5" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await request(u.id, { amount: "10.001" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await request(u.id, { method: "card" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await request(u.id, { transactionId: "12" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await db().payment.count()).toBe(0);
  });

  it("refuses a transaction ID that was already submitted (by anyone)", async () => {
    const a = await createUser();
    const b = await createUser();
    expect(await request(a.id, { transactionId: "8812345678" })).toMatchObject({ ok: true });
    expect(await request(b.id, { transactionId: "88 1234 5678" })).toMatchObject({ ok: false, message: expect.stringMatching(/already been submitted/) });
    expect(await db().payment.count()).toBe(1);
  });

  it("a double submit with the same key creates one request", async () => {
    const u = await createUser();
    const k = key();
    const t = tid();
    const [x, y] = await Promise.all([request(u.id, { idempotencyKey: k, transactionId: t }), request(u.id, { idempotencyKey: k, transactionId: t })]);
    expect(x.ok && y.ok && x.payment.id === y.payment.id).toBe(true);
    expect(await db().payment.count()).toBe(1);
  });

  it("the gateway flow refuses while the manual method is active", async () => {
    const u = await createUser();
    expect(await createTopUp(u.id, { amount: "10", method: "easypaisa", idempotencyKey: key() })).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("maintenance mode pauses requests", async () => {
    const u = await createUser();
    await saveSetting("maintenance", { enabled: true, message: "" });
    expect(await request(u.id)).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });
});

describe("admin approval and rejection", () => {
  it("approval credits the wallet exactly once, even when repeated concurrently", async () => {
    const { actor } = await admin();
    const u = await createUser();
    const r = await request(u.id, { amount: "15" });
    if (!r.ok) throw new Error(r.message);
    const results = await Promise.all([approveTopUp(actor, r.payment.id), approveTopUp(actor, r.payment.id), approveTopUp(actor, r.payment.id)]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect((await getBalance(u.id)).balance).toBe(USD(15));
    const ledger = await db().transaction.findMany({ where: { paymentId: r.payment.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "DEPOSIT", reference: `payment:${r.payment.id}:credit` });
    const row = await db().payment.findUniqueOrThrow({ where: { id: r.payment.id } });
    expect(row).toMatchObject({ status: "PAID", reviewedById: actor.id });
    expect(row.reviewedAt).toBeInstanceOf(Date);
    expect(await approveTopUp(actor, r.payment.id)).toMatchObject({ ok: false, message: expect.stringMatching(/already approved/) });
    const actions = (await db().auditLog.findMany({ where: { success: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["topup.created", "topup.approved", "wallet.credited"]));
    expect(await getTopUp(u.id, r.payment.id)).toMatchObject({ status: "paid", reviewedAt: expect.any(String) });
  });

  it("an administrator can't approve their own request", async () => {
    const { actor } = await admin();
    const r = await request(actor.id);
    if (!r.ok) throw new Error(r.message);
    expect(await approveTopUp(actor, r.payment.id)).toMatchObject({ ok: false, message: expect.stringMatching(/own top-up/) });
    expect((await getBalance(actor.id)).balance).toBe(0);
  });

  it("rejection stores the reason, never credits, and is final", async () => {
    const { actor } = await admin();
    const u = await createUser();
    const r = await request(u.id);
    if (!r.ok) throw new Error(r.message);
    expect(await rejectTopUp(actor, r.payment.id, "no")).toMatchObject({ ok: false });
    expect(await rejectTopUp(actor, r.payment.id, "No payment with this transaction ID was received.")).toMatchObject({ ok: true });
    expect(await approveTopUp(actor, r.payment.id)).toMatchObject({ ok: false });
    expect((await getBalance(u.id)).balance).toBe(0);
    expect(await getTopUp(u.id, r.payment.id)).toMatchObject({ status: "rejected", rejectionReason: "No payment with this transaction ID was received." });
    expect((await listTopUps(u.id)).items[0]).toMatchObject({ status: "rejected" });
    // The database refuses to turn a rejected request into a paid one.
    await expect(db().payment.update({ where: { id: r.payment.id }, data: { status: "PAID" } })).rejects.toThrow();
    expect(await db().auditLog.count({ where: { action: "topup.rejected" } })).toBe(1);
  });

  it("customers can't see each other's requests", async () => {
    const a = await createUser();
    const b = await createUser();
    const r = await request(a.id);
    if (!r.ok) throw new Error(r.message);
    expect(await getTopUp(b.id, r.payment.id)).toBeNull();
    expect((await listTopUps(b.id)).total).toBe(0);
  });

  it("approve/reject APIs are admin-only and take no amount or user from the client", async () => {
    const adm = await admin();
    const u = await createUser();
    const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
    const r = await request(u.id, { amount: "5" });
    if (!r.ok) throw new Error(r.message);
    const call = (handler: unknown, token: string, body: unknown) =>
      (handler as (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>)(
        new NextRequest(`http://localhost:3000/api/admin/topups/${r.payment.id}/approve`, {
          method: "POST",
          headers: { cookie: `rocksms_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: r.payment.id }) },
      );
    expect((await call(postAdminTopUpApprove, s.token, {})).status).toBe(403); // the customer themselves
    expect((await call(postAdminTopUpApprove, adm.token, { amount: "500" })).status).toBe(400); // no client amounts
    expect((await call(postAdminTopUpReject, adm.token, { reason: "x" })).status).toBe(400);
    expect((await call(postAdminTopUpApprove, adm.token, {})).status).toBe(200);
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("approveManualTopUp ignores non-manual payments", async () => {
    const { actor } = await admin();
    expect(await approveManualTopUp(actor.id, "00000000-0000-4000-8000-000000000000")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
