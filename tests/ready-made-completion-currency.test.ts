import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import { createReadyMadeOffer } from "@/server/admin/ready-made";
import { formatConverted as formatConvertedIsolated } from "@/lib/display-currency";
import { ltr, stripBidi } from "@/lib/format";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { getDisplayRates, resetExchangeRateCache } from "@/server/services/exchange-rates";
import { completeReadyMadeOrder, getReadyMadeOrder, purchaseReadyMade } from "@/server/services/ready-made.service";
import { clearSettingsCache } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { createUser, resetDatabase, USD } from "./helpers";

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");

async function boughtOrder(balance = 10) {
  const admin = await createUser();
  await db().user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  const actor: AdminActor = { id: admin.id, email: admin.email, name: admin.name, sessionId: "test" };
  const svc = await db().service.create({ data: { provider: "fake", providerCode: "wa", slug: "wa", name: "Whatsapp" } });
  await createReadyMadeOffer(actor, { serviceId: svc.id, countryId: null, price: "2.50", availableQuantity: "100", isActive: true });
  const offer = await db().readyMadeOffer.findFirstOrThrow();
  const buyer = await createUser();
  await creditWallet({ userId: buyer.id, amount: USD(balance), type: "DEPOSIT", reference: `test:${buyer.id}:fund` });
  const r = await purchaseReadyMade(buyer.id, { offerId: offer.id, price: USD(2.5), idempotencyKey: key() });
  if (!r.ok) throw new Error("purchase failed");
  return { buyer, orderId: r.orderId, offer };
}

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DISPLAY_PKR_RATE;
  delete process.env.DISPLAY_INR_RATE;
  delete process.env.DISPLAY_BDT_RATE;
  resetEnvCache();
  resetExchangeRateCache();
});
afterAll(() => db().$disconnect());

describe("Ready Made — buyer marks the order completed", () => {
  it("starts awaiting delivery and only the buyer can complete it, once", async () => {
    const { buyer, orderId } = await boughtOrder();
    expect(await getReadyMadeOrder(buyer.id, orderId)).toMatchObject({ status: "awaiting_delivery", completedAt: null });

    const stranger = await createUser();
    expect(await completeReadyMadeOrder(stranger.id, orderId)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect((await db().readyMadeOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("AWAITING_DELIVERY");

    expect(await completeReadyMadeOrder(buyer.id, orderId)).toEqual({ ok: true });
    const done = await getReadyMadeOrder(buyer.id, orderId);
    expect(done).toMatchObject({ status: "completed", completedAt: expect.any(String) });
    expect(await completeReadyMadeOrder(buyer.id, orderId)).toMatchObject({ ok: false, code: "ALREADY_COMPLETED" });
    expect(await completeReadyMadeOrder(buyer.id, "00000000-0000-0000-0000-000000000000")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    // Completing doesn't move money.
    expect((await getBalance(buyer.id)).balance).toBe(USD(7.5));
    expect(await db().transaction.count({ where: { userId: buyer.id } })).toBe(2);
  });

  it("concurrent completions succeed exactly once", async () => {
    const { buyer, orderId } = await boughtOrder();
    const results = await Promise.all(Array.from({ length: 5 }, () => completeReadyMadeOrder(buyer.id, orderId)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("database guard: completed is final", async () => {
    const { buyer, orderId, offer } = await boughtOrder();
    await completeReadyMadeOrder(buyer.id, orderId);
    await expect(db().readyMadeOrder.update({ where: { id: orderId }, data: { status: "AWAITING_DELIVERY" } })).rejects.toThrow();
    await expect(db().readyMadeOrder.update({ where: { id: orderId }, data: { completedAt: new Date(0) } })).rejects.toThrow();
    // COMPLETED always carries its completion time.
    const second = await purchaseReadyMade(buyer.id, { offerId: offer.id, price: USD(2.5), idempotencyKey: key() });
    if (!second.ok) throw new Error("purchase failed");
    await expect(db().readyMadeOrder.update({ where: { id: second.orderId }, data: { status: "COMPLETED" } })).rejects.toThrow();
  });
});

describe("Display currencies (USD / PKR / INR / BDT) — display only", () => {
  const live = (rates: Record<string, number>) => ({ result: "success", base_code: "USD", time_last_update_unix: 1_790_000_000, rates: { USD: 1, ...rates } });
  const rate = (currency: "PKR" | "INR" | "BDT", r: number) => ({ currency, rate: r, source: "live" as const, updatedAt: null });

  // Amounts are wrapped in bidi isolates (correct in RTL text); compare the visible text.
  const formatConverted = (...args: Parameters<typeof formatConvertedIsolated>) => stripBidi(formatConvertedIsolated(...args));

  it("formats each currency with its symbol and sensible decimals", () => {
    expect(formatConvertedIsolated(USD(2), rate("PKR", 276.984))).toBe(ltr("Rs 554"));
    expect(formatConverted(USD(2), rate("PKR", 276.984))).toBe("Rs 554");
    expect(formatConverted(USD(2), rate("INR", 84.1))).toBe("₹168");
    expect(formatConverted(USD(2), rate("BDT", 121.9))).toBe("৳244");
    expect(formatConverted(USD(1234.5), rate("PKR", 276.984))).toBe("Rs 341,937");
    expect(formatConverted(USD(2500), rate("INR", 84.1))).toBe("₹2,10,250"); // Indian digit grouping
    expect(formatConverted(USD(0.03), rate("INR", 84.1))).toBe("₹2.52");
    expect(formatConverted(-USD(2), rate("PKR", 276.984))).toBe("−Rs 554");
    expect(formatConverted(USD(2), rate("BDT", 121.9), { signed: true })).toBe("+৳244");
  });

  it("uses fixed DISPLAY_<CODE>_RATE values without any outbound request", async () => {
    process.env.DISPLAY_PKR_RATE = "280";
    process.env.DISPLAY_INR_RATE = "84";
    process.env.DISPLAY_BDT_RATE = "122";
    resetEnvCache();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await getDisplayRates();
    expect(r.base).toBe("USD");
    expect(r.rates).toEqual({
      PKR: { currency: "PKR", rate: 280, baseRate: 280, markup: 0, source: "configured", updatedAt: null },
      INR: { currency: "INR", rate: 84, baseRate: 84, markup: 0, source: "configured", updatedAt: null },
      BDT: { currency: "BDT", rate: 122, baseRate: 122, markup: 0, source: "configured", updatedAt: null },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches all live rates in one request, caches them, and mixes in fixed overrides", async () => {
    process.env.DISPLAY_PKR_RATE = "280";
    resetEnvCache();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(live({ PKR: 276.98, INR: 84.1, BDT: 121.9 })), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getDisplayRates();
    expect(r.rates.PKR).toMatchObject({ rate: 280, source: "configured" });
    expect(r.rates.INR).toMatchObject({ rate: 84.1, source: "live" });
    expect(r.rates.BDT).toMatchObject({ rate: 121.9, source: "live" });
    await getDisplayRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never invents a rate: an outage or a missing currency means no conversion", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 503 })));
    expect((await getDisplayRates()).rates).toEqual({});
    resetExchangeRateCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(live({ INR: 84.1 })), { status: 200 })));
    const r = await getDisplayRates();
    expect(Object.keys(r.rates)).toEqual(["INR"]);
    resetExchangeRateCache();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect((await getDisplayRates()).rates).toEqual({});
  });

  it("keeps serving the last good rates when a refresh fails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(live({ PKR: 276.98, INR: 84.1, BDT: 121.9 })), { status: 200 })));
      expect((await getDisplayRates()).rates.PKR?.rate).toBe(276.98);
      vi.setSystemTime(Date.now() + 7 * 60 * 60 * 1000); // past the 6 h TTL
      vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 503 })));
      expect((await getDisplayRates()).rates.PKR?.rate).toBe(276.98); // stale but valid
      vi.setSystemTime(Date.now() + 4 * 24 * 60 * 60 * 1000); // beyond 3 days: dropped
      expect((await getDisplayRates()).rates).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });

  it("never changes what a purchase is charged", async () => {
    process.env.DISPLAY_PKR_RATE = "280";
    resetEnvCache();
    const { buyer, offer } = await boughtOrder();
    expect((await getBalance(buyer.id)).balance).toBe(USD(7.5));
    // A converted amount sent as the price (e.g. "Rs 700" or "₹210") is refused, not charged.
    for (const converted of [USD(2.5 * 280), USD(2.5 * 84), 2.5 * 10_000 * 122]) {
      expect(await purchaseReadyMade(buyer.id, { offerId: offer.id, price: converted, idempotencyKey: key() })).toMatchObject({ ok: false, code: "PRICE_CHANGED", price: USD(2.5) });
    }
    expect((await getBalance(buyer.id)).balance).toBe(USD(7.5));
    expect((await db().readyMadeOffer.findUniqueOrThrow({ where: { id: offer.id } })).price.toString()).toBe("2.5");
  });
});
