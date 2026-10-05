import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import { saveTopUpMinimum } from "@/server/admin/platform";
import { postPayment } from "@/server/api/payments";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { ManualPaymentProvider } from "@/server/payments/manual/manual-provider";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import { createApiKey } from "@/server/services/api-key.service";
import { createManualTopUp, createTopUp, getTopUpOptions } from "@/server/services/payment.service";
import { clearSettingsCache, getSetting } from "@/server/services/settings.service";
import { FakePaymentProvider } from "./fake-payment-provider";
import { createUser, resetDatabase, USD } from "./helpers";

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
let tidCounter = 1000;
const tid = () => `TID${Date.now()}${tidCounter++}`;

const manual = (userId: string, amount: string) =>
  createManualTopUp(userId, { amount, method: "easypaisa", transactionId: tid(), idempotencyKey: key() });

async function adminActor(): Promise<AdminActor> {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  return { id: u.id, email: u.email, name: u.name, sessionId: (await validateSessionToken(s.token))!.sessionId };
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

describe("minimum top-up setting", () => {
  it("defaults to 10 USD", async () => {
    expect(await getSetting("topup")).toEqual({ minAmount: "10" });
    const o = await getTopUpOptions();
    expect(o.min).toBe(USD(10));
    expect(o.presets.every((p) => p >= USD(10))).toBe(true);

    const u = await createUser();
    expect(await manual(u.id, "9.99")).toMatchObject({ ok: false, code: "INVALID" });
    expect((await manual(u.id, "10")).ok).toBe(true);
  });

  it("can be changed by an admin, and the change is audited", async () => {
    const actor = await adminActor();
    expect(await saveTopUpMinimum(actor, { minAmount: "5" })).toMatchObject({ ok: true });
    expect(await getSetting("topup")).toEqual({ minAmount: "5" });
    expect((await getTopUpOptions()).min).toBe(USD(5));
    const row = await db().auditLog.findFirstOrThrow({ where: { action: "topup_minimum.update" } });
    expect(row).toMatchObject({ actorId: actor.id, success: true });
    expect(row.metadata).toEqual({ before: { minAmount: "10" }, after: { minAmount: "5" } });
  });

  it("accepts exactly the minimum and more, and rejects less", async () => {
    await saveTopUpMinimum(await adminActor(), { minAmount: "5" });
    const u = await createUser();
    expect(await manual(u.id, "4.99")).toMatchObject({ ok: false, code: "INVALID", message: expect.stringContaining("between 5 and 1000") });
    expect((await manual(u.id, "5")).ok).toBe(true);
    expect((await manual(u.id, "5.01")).ok).toBe(true);
    expect((await manual(u.id, "250")).ok).toBe(true);
  });

  it("applies a new value to the very next request", async () => {
    const actor = await adminActor();
    const u = await createUser();
    await saveTopUpMinimum(actor, { minAmount: "20" });
    expect(await manual(u.id, "10")).toMatchObject({ ok: false, code: "INVALID" });
    expect((await manual(u.id, "20")).ok).toBe(true);

    await saveTopUpMinimum(actor, { minAmount: "50" });
    expect(await manual(u.id, "20")).toMatchObject({ ok: false, code: "INVALID" });
    expect((await getTopUpOptions()).min).toBe(USD(50));
    expect((await manual(u.id, "50")).ok).toBe(true);

    await saveTopUpMinimum(actor, { minAmount: "1" });
    expect((await manual(u.id, "1")).ok).toBe(true);
  });

  it("is enforced on the gateway flow and the public API, not only in the UI", async () => {
    setPaymentProviderForTesting(new FakePaymentProvider());
    await saveTopUpMinimum(await adminActor(), { minAmount: "15" });
    const u = await createUser();
    expect(await createTopUp(u.id, { amount: "14.99", method: "card", idempotencyKey: key() })).toMatchObject({ ok: false, code: "INVALID" });
    expect((await createTopUp(u.id, { amount: "15", method: "card", idempotencyKey: key() })).ok).toBe(true);

    const { key: apiKey } = await createApiKey(u.id);
    const call = async (amount: string | number) => {
      const req = new NextRequest("http://localhost:3000/api/payments", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": key() },
        body: JSON.stringify({ amount, method: "card" }),
      });
      return (await postPayment(req, { params: Promise.resolve({}) })).status;
    };
    expect(await call("10")).toBe(400);
    expect(await call(14.99)).toBe(400);
    expect(await call("15")).toBe(201);
    expect(await call(20)).toBe(201);
  });

  it("rejects invalid values and keeps the current one", async () => {
    const actor = await adminActor();
    await saveTopUpMinimum(actor, { minAmount: "7.5" });
    for (const bad of ["", "   ", "0", "0.00", "-5", "abc", "5.123", "1e3", "5..0", "$5", "1000.01", "5000"]) {
      expect(await saveTopUpMinimum(actor, { minAmount: bad }), bad).toMatchObject({ ok: false });
    }
    expect(await getSetting("topup")).toEqual({ minAmount: "7.5" });
    // Normalized, and the maximum itself is allowed.
    expect(await saveTopUpMinimum(actor, { minAmount: " 012,50 " })).toMatchObject({ ok: true });
    expect(await getSetting("topup")).toEqual({ minAmount: "12.5" });
    expect(await saveTopUpMinimum(actor, { minAmount: "1000" })).toMatchObject({ ok: true });
  });

  it("ignores a malformed stored value and falls back to the default", async () => {
    await db().setting.create({ data: { key: "topup", value: { minAmount: "-3" } } });
    clearSettingsCache();
    expect((await getTopUpOptions()).min).toBe(USD(10));
  });
});
