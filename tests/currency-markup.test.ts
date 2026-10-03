import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertToCents, effectiveRate, formatConverted, type DisplayRate } from "@/lib/display-currency";
import { stripBidi } from "@/lib/format";
import { createReadyMadeOffer } from "@/server/admin/ready-made";
import type { AdminActor } from "@/server/admin/guard";
import { saveCurrencyMarkup } from "@/server/admin/platform";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { getDisplayRates, getEffectiveRate, resetExchangeRateCache } from "@/server/services/exchange-rates";
import { purchaseReadyMade } from "@/server/services/ready-made.service";
import { clearSettingsCache } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { createUser, resetDatabase, USD } from "./helpers";

async function admin(): Promise<AdminActor> {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  return { id: u.id, email: u.email, name: u.name, sessionId: "test" };
}

const show = (minor: number, rate: DisplayRate | null) => stripBidi(formatConverted(minor, rate!));

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  resetExchangeRateCache();
  // The spec's controlled example: base rates 282 / 83 / 118, no outbound requests.
  process.env.DISPLAY_PKR_RATE = "282";
  process.env.DISPLAY_INR_RATE = "83";
  process.env.DISPLAY_BDT_RATE = "118";
  resetEnvCache();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  delete process.env.DISPLAY_PKR_RATE;
  delete process.env.DISPLAY_INR_RATE;
  delete process.env.DISPLAY_BDT_RATE;
  resetEnvCache();
  vi.unstubAllGlobals();
});
afterAll(() => db().$disconnect());

describe("conversion tax / markup", () => {
  it("defaults to 0: rates are exactly as before", async () => {
    const r = await getDisplayRates();
    expect(r.rates.PKR).toMatchObject({ baseRate: 282, markup: 0, rate: 282 });
    expect(show(USD(10), r.rates.PKR!)).toBe("Rs 2,820");
  });

  it("is added to the RATE (282 + 5 = 287), so $10 → Rs 2,870, not Rs 2,825", async () => {
    const a = await admin();
    expect(await saveCurrencyMarkup(a, { PKR: "5", INR: "2", BDT: "3" })).toMatchObject({ ok: true });
    const pkr = await getEffectiveRate("PKR");
    expect(pkr).toMatchObject({ baseRate: 282, markup: 5, rate: 287 });
    expect(show(USD(1), pkr)).toBe("Rs 287");
    expect(show(USD(10), pkr)).toBe("Rs 2,870");
    expect(show(USD(100), pkr)).toBe("Rs 28,700");
    expect((await getEffectiveRate("INR"))?.rate).toBe(85);
    expect(show(USD(100), await getEffectiveRate("INR"))).toBe("₹8,500");
    expect((await getEffectiveRate("BDT"))?.rate).toBe(121);
    expect(show(USD(100), await getEffectiveRate("BDT"))).toBe("৳12,100");
    // Audited.
    const log = await db().auditLog.findFirstOrThrow({ where: { action: "currency_markup.update" } });
    expect(log.description).toBe("Conversion tax set to PKR 5 · INR 2 · BDT 3");
  });

  it("applies on top of the live feed too, and still applies when the feed is down", async () => {
    delete process.env.DISPLAY_PKR_RATE;
    resetEnvCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: "success", base_code: "USD", time_last_update_unix: 1_790_000_000, rates: { USD: 1, PKR: 282, INR: 83, BDT: 118 } }))),
    );
    await saveCurrencyMarkup(await admin(), { PKR: "5", INR: "0", BDT: "0" });
    expect(await getEffectiveRate("PKR")).toMatchObject({ source: "live", baseRate: 282, rate: 287 });
    // Feed down: the cached rate is kept and the markup still applies.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect((await getEffectiveRate("PKR"))?.rate).toBe(287);
  });

  it("uses exact decimals (no 2869.999…), keeps small amounts to 2 decimals", () => {
    expect(effectiveRate(276.98, 0.01)).toBe(276.99);
    expect(effectiveRate(0.1, 0.2)).toBe(0.3);
    expect(convertToCents(USD(10), 287)).toBe(BigInt(287_000));
    expect(stripBidi(formatConverted(USD(10), { currency: "PKR", rate: effectiveRate(282.37, 5.5) }))).toBe("Rs 2,879");
    expect(stripBidi(formatConverted(USD(0.03), { currency: "INR", rate: 85 }))).toBe("₹2.55");
    expect(stripBidi(formatConverted(-USD(1), { currency: "PKR", rate: 287 }))).toBe("−Rs 287");
  });

  it("validates server-side: numbers from 0, up to 4 decimals; bad input changes nothing", async () => {
    const a = await admin();
    for (const bad of ["-5", "abc", "1.23456", "1e3", "100001"]) {
      expect(await saveCurrencyMarkup(a, { PKR: bad, INR: "0", BDT: "0" })).toMatchObject({ ok: false });
    }
    expect((await getEffectiveRate("PKR"))?.rate).toBe(282);
    expect(await saveCurrencyMarkup(a, { PKR: "5.50", INR: "", BDT: "0" })).toMatchObject({ ok: true });
    expect(await getEffectiveRate("PKR")).toMatchObject({ markup: 5.5, rate: 287.5 });
    expect((await getEffectiveRate("INR"))?.markup).toBe(0);
  });

  it("is display only: purchases are still charged the stored USD price", async () => {
    const a = await admin();
    await saveCurrencyMarkup(a, { PKR: "5", INR: "2", BDT: "3" });
    const svc = await db().service.create({ data: { provider: "fake", providerCode: "wa", slug: "wa", name: "Whatsapp" } });
    await createReadyMadeOffer(a, { serviceId: svc.id, countryId: null, price: "5", availableQuantity: "3", isActive: true });
    const offer = await db().readyMadeOffer.findFirstOrThrow();
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(10), type: "DEPOSIT", reference: `test:${u.id}` });
    expect(await purchaseReadyMade(u.id, { offerId: offer.id, price: USD(5), idempotencyKey: "k".repeat(24) })).toMatchObject({ ok: true });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
    expect((await db().readyMadeOffer.findFirstOrThrow()).price.toString()).toBe("5");
  });
});
