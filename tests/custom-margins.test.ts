import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import { createMarginRule, deleteMarginRule, listMarginRules, updateMarginRule } from "@/server/admin/margins";
import { savePricing } from "@/server/admin/platform";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import { getOffersForService, quote, syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { requestNumber } from "@/server/services/order.service";
import { invalidateMarginRules, setPricingRules } from "@/server/services/pricing-rules";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { clearSettingsCache } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

/*
 * FakeProvider costs: tg/USA 0.35 (+ a 0.50 level), tg/UK 0.80, wa/USA 1.20.
 * Global rule in these tests: 20 % markup, 0.10 minimum margin.
 */
let actor: AdminActor;
let ids: { tg: number; wa: number; usa: number; uk: number };

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
const storedPrice = async (serviceId: number, countryId: number) =>
  (await db().price.findUniqueOrThrow({ where: { serviceId_countryId: { serviceId, countryId } } })).price.toString();
const offer = async (slug: string, countryId: number) => {
  const r = await getOffersForService(slug);
  if (r.status !== "ok") throw new Error("offers unavailable");
  return r.data.find((g) => g.country.id === String(countryId))!;
};

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  setPricingRules(null);
  invalidateMarginRules();
  setProviderForTesting(new FakeProvider());
  invalidateProviderBalance();
  const admin = await createUser();
  await db().user.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  actor = { id: admin.id, email: admin.email, name: admin.name, sessionId: "test" };
  await savePricing(actor, { markupPercent: "20", minMargin: "0.10" });
  await syncCatalog();
  const svc = (code: string) => db().service.findFirstOrThrow({ where: { providerCode: code } });
  const cty = (code: string) => db().country.findFirstOrThrow({ where: { providerCode: code } });
  ids = { tg: (await svc("tg")).id, wa: (await svc("wa")).id, usa: (await cty("12")).id, uk: (await cty("16")).id };
});
afterEach(() => {
  setProviderForTesting(undefined);
  invalidateMarginRules();
});
afterAll(() => db().$disconnect());

describe("customerPrice with a custom minimum margin", () => {
  const rules = { markupPercent: "20", minMargin: "0.10" };
  it("replaces the global minimum margin — it is not added to it", () => {
    expect(customerPrice(3500, rules)).toBe(USD(0.45)); // max(0.42, 0.35 + 0.10)
    expect(customerPrice(3500, rules, "0.30")).toBe(USD(0.65)); // max(0.42, 0.35 + 0.30), not 0.75
  });
  it("keeps the global markup: the higher of markup and margin wins", () => {
    expect(customerPrice(USD(10), rules, "0.30")).toBe(USD(12)); // 10 × 1.2 beats 10 + 0.30
    expect(customerPrice(USD(1.2), rules)).toBe(USD(1.44));
    expect(customerPrice(USD(1.2), rules, "0.30")).toBe(USD(1.5));
  });
});

describe("Service + country custom margins", () => {
  it("global only: every pair uses the global minimum margin", async () => {
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.45");
    expect(await storedPrice(ids.tg, ids.uk)).toBe("0.96");
    expect(await storedPrice(ids.wa, ids.usa)).toBe("1.44");
  });

  it("an override applies to that service + country only — stored, live offers, quote and the actual charge", async () => {
    expect(await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" })).toMatchObject({ ok: true });
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.65");
    // Other country, other service: unchanged.
    expect(await storedPrice(ids.tg, ids.uk)).toBe("0.96");
    expect(await storedPrice(ids.wa, ids.usa)).toBe("1.44");

    // Live price levels (0.35 → 0.65; 0.50 → max(0.60, 0.80) = 0.80).
    const us = await offer("tg", ids.usa);
    expect(us.tiers.map((t) => t.price).sort((a, b) => a - b)).toEqual([USD(0.65), USD(0.8)]);
    expect((await offer("tg", ids.uk)).minPrice).toBe(USD(0.96));

    // Purchase-time quote and the real charge use the override.
    const q = await quote("tg", String(ids.usa), USD(0.45));
    expect(q?.match).toBeNull();
    expect(q?.currentPrices).toContain(USD(0.65));
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(5), type: "DEPOSIT", reference: `fund:${u.id}` });
    expect(await requestNumber(u.id, { service: "tg", country: String(ids.usa), price: USD(0.45), idempotencyKey: key() })).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect(await requestNumber(u.id, { service: "tg", country: String(ids.usa), price: USD(0.65), idempotencyKey: key() })).toMatchObject({ ok: true });
    expect((await getBalance(u.id)).balance).toBe(USD(5) - USD(0.65));
  });

  it("multiple rules: each pair gets its own margin", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.uk, minMargin: "0.25" });
    await createMarginRule(actor, { serviceId: ids.wa, countryId: ids.usa, minMargin: "0.30" });
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.65");
    expect(await storedPrice(ids.tg, ids.uk)).toBe("1.05"); // max(0.96, 0.80 + 0.25)
    expect(await storedPrice(ids.wa, ids.usa)).toBe("1.5");
    const { rules } = await listMarginRules();
    expect(rules.map((r) => [r.service.id, r.country.id, r.minMargin])).toHaveLength(3);
  });

  it("deleting a rule falls back to the global margin", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    const rule = await db().serviceCountryMargin.findFirstOrThrow();
    expect(await deleteMarginRule(actor, rule.id)).toMatchObject({ ok: true });
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.45");
    expect((await offer("tg", ids.usa)).minPrice).toBe(USD(0.45));
  });

  it("changing the global margin affects pairs without a rule; rules keep their own margin", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    await savePricing(actor, { markupPercent: "20", minMargin: "0.20" });
    expect(await storedPrice(ids.tg, ids.uk)).toBe("1"); // max(0.96, 0.80 + 0.20)
    expect(await storedPrice(ids.wa, ids.usa)).toBe("1.44"); // markup still wins
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.65"); // custom 0.30 replaces global 0.20
    // A global markup change still applies to the pair with a rule.
    await savePricing(actor, { markupPercent: "100", minMargin: "0.20" });
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.7"); // max(0.70, 0.35 + 0.30)
  });

  it("a catalog sync stores the override too", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    await db().price.update({ where: { serviceId_countryId: { serviceId: ids.tg, countryId: ids.usa } }, data: { price: "9.99" } });
    await db().setting.deleteMany({ where: { key: { not: "pricing" } } }); // clear the sync lock
    await syncCatalog();
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.65");
  });

  it("an admin price override still wins over every margin", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    await db().price.update({ where: { serviceId_countryId: { serviceId: ids.tg, countryId: ids.usa } }, data: { priceOverride: "0.99" } });
    expect((await offer("tg", ids.usa)).tiers.map((t) => t.price)).toEqual([USD(0.99)]);
  });

  it("moving a rule to another pair restores the old pair's global price", async () => {
    await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" });
    const rule = await db().serviceCountryMargin.findFirstOrThrow();
    expect(await updateMarginRule(actor, rule.id, { serviceId: ids.tg, countryId: ids.uk, minMargin: "0.40" })).toMatchObject({ ok: true });
    expect(await storedPrice(ids.tg, ids.usa)).toBe("0.45");
    expect(await storedPrice(ids.tg, ids.uk)).toBe("1.2"); // max(0.96, 0.80 + 0.40)
  });

  it("validates input, refuses duplicates and audits every change", async () => {
    for (const minMargin of ["", "-1", "abc", "101", "0.12345"]) {
      expect(await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin })).toMatchObject({ ok: false });
    }
    expect(await createMarginRule(actor, { serviceId: 999_999, countryId: ids.usa, minMargin: "0.3" })).toMatchObject({ ok: false });
    expect(await createMarginRule(actor, { serviceId: ids.tg, countryId: 999_999, minMargin: "0.3" })).toMatchObject({ ok: false });
    expect(await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" })).toMatchObject({ ok: true });
    expect(await createMarginRule(actor, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.50" })).toMatchObject({ ok: false, message: expect.stringContaining("already") });
    await createMarginRule(actor, { serviceId: ids.wa, countryId: ids.usa, minMargin: "0.30" });
    const [a, b] = await db().serviceCountryMargin.findMany({ orderBy: { id: "asc" } });
    expect(await updateMarginRule(actor, b.id, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.30" })).toMatchObject({ ok: false });
    await updateMarginRule(actor, a.id, { serviceId: ids.tg, countryId: ids.usa, minMargin: "0.35" });
    await deleteMarginRule(actor, b.id);
    const actions = (await db().auditLog.findMany({ where: { action: { startsWith: "pricing.margin_rule" } }, select: { action: true, actorId: true } })).map((l) => l.action);
    expect(actions).toEqual(["pricing.margin_rule_created", "pricing.margin_rule_created", "pricing.margin_rule_updated", "pricing.margin_rule_deleted"]);
    await expect(db().serviceCountryMargin.create({ data: { serviceId: ids.wa, countryId: ids.uk, minMargin: "-1" } })).rejects.toThrow();
  });
});
