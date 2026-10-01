import "server-only";
import { toDecimalString, toMinor } from "@/lib/money";
import { db, isUniqueViolation } from "@/server/db";
import { customerPrice, platformCurrency } from "@/server/services/currency";
import { invalidateMarginRules, loadPricingRules, type PricingRules } from "@/server/services/pricing-rules";
import { getSetting } from "@/server/services/settings.service";
import { audit } from "./audit";
import type { AdminActor } from "./guard";
import type { AdminResult } from "./users";

/**
 * Admin → Custom Margins: a minimum margin for one service in one country that
 * REPLACES the global minimum margin (Admin → Pricing) for that pair. The
 * global markup still applies, and everything without a rule keeps the global
 * rule. Prices are always computed by customerPrice() — this module only
 * stores the exceptions and refreshes the affected stored price.
 */

export type MarginInput = { serviceId: number; countryId: number; minMargin: string };

export type MarginRow = {
  id: number;
  service: { id: number; name: string };
  country: { id: number; name: string; iso2: string | null };
  /** Minor units of the platform currency. */
  minMargin: number;
  /** The stored offer for this pair, if the provider lists one. */
  offer: { providerCost: number; providerCurrency: string; price: number; priceOverride: boolean } | null;
  updatedAt: string;
};

/** Same bounds and format as the global minimum margin (Admin → Pricing). */
const MARGIN_RE = /^\d{1,3}(\.\d{1,4})?$/;

export async function listMarginRules(): Promise<{ rules: MarginRow[]; globalMinMargin: number; currency: string }> {
  const [rows, global] = await Promise.all([
    db().serviceCountryMargin.findMany({
      include: { service: { select: { id: true, name: true } }, country: { select: { id: true, name: true, iso2: true } } },
      orderBy: [{ service: { name: "asc" } }, { country: { name: "asc" } }],
    }),
    getSetting("pricing"),
  ]);
  const prices = rows.length
    ? await db().price.findMany({
        where: { OR: rows.map((r) => ({ serviceId: r.serviceId, countryId: r.countryId })) },
        select: { serviceId: true, countryId: true, providerCost: true, providerCurrency: true, price: true, priceOverride: true },
      })
    : [];
  return {
    rules: rows.map((r) => {
      const p = prices.find((x) => x.serviceId === r.serviceId && x.countryId === r.countryId);
      return {
        id: r.id,
        service: r.service,
        country: r.country,
        minMargin: toMinor(r.minMargin),
        offer: p
          ? { providerCost: toMinor(p.providerCost), providerCurrency: p.providerCurrency, price: toMinor(p.priceOverride ?? p.price), priceOverride: p.priceOverride !== null }
          : null,
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
    globalMinMargin: toMinor(global.minMargin),
    currency: platformCurrency().code,
  };
}

/** Choices for the form: services and countries known to the catalog (the rule's own pair included). */
export async function marginFormOptions() {
  const [services, countries] = await Promise.all([
    db().service.findMany({ where: { providerActive: true }, select: { id: true, name: true }, orderBy: [{ isPopular: "desc" }, { name: "asc" }] }),
    db().country.findMany({ where: { providerActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { services, countries };
}

type Checked = { ok: false; message: string } | { ok: true; serviceId: number; countryId: number; minMargin: string; label: string };

async function check(input: MarginInput): Promise<Checked> {
  const [service, country] = await Promise.all([
    db().service.findUnique({ where: { id: input.serviceId }, select: { name: true } }),
    db().country.findUnique({ where: { id: input.countryId }, select: { name: true } }),
  ]);
  if (!service) return { ok: false, message: "Choose an existing service." };
  if (!country) return { ok: false, message: "Choose an existing country." };
  const margin = input.minMargin.trim().replace(",", ".");
  if (!MARGIN_RE.test(margin) || Number(margin) > 100) return { ok: false, message: "Minimum margin must be between 0 and 100 (up to 4 decimals)." };
  return { ok: true, serviceId: input.serviceId, countryId: input.countryId, minMargin: toDecimalString(toMinor(margin)), label: `${service.name} · ${country.name}` };
}

const DUPLICATE: AdminResult = { ok: false, message: "This service and country already have a custom margin. Edit the existing rule instead." };

/** Recomputes the stored customer price of one service + country with the current rules. */
async function repricePair(serviceId: number, countryId: number): Promise<void> {
  invalidateMarginRules();
  const rules = await loadPricingRules();
  const row = await db().price.findUnique({ where: { serviceId_countryId: { serviceId, countryId } }, select: { id: true, providerCost: true } });
  if (!row) return;
  const override = await db().serviceCountryMargin.findUnique({ where: { serviceId_countryId: { serviceId, countryId } }, select: { minMargin: true } });
  const price = customerPrice(toMinor(row.providerCost), rules, override ? toDecimalString(toMinor(override.minMargin)) : null);
  await db().price.update({ where: { id: row.id }, data: { price: toDecimalString(price) } });
}

/** After a global pricing change: re-apply every exception to its stored price. */
export async function repriceCustomMargins(rules: PricingRules): Promise<void> {
  invalidateMarginRules();
  const rows = await db().serviceCountryMargin.findMany({ select: { serviceId: true, countryId: true, minMargin: true } });
  for (const r of rows) {
    const p = await db().price.findUnique({ where: { serviceId_countryId: { serviceId: r.serviceId, countryId: r.countryId } }, select: { id: true, providerCost: true } });
    if (!p) continue;
    const price = customerPrice(toMinor(p.providerCost), rules, toDecimalString(toMinor(r.minMargin)));
    await db().price.update({ where: { id: p.id }, data: { price: toDecimalString(price) } });
  }
}

export async function createMarginRule(actor: AdminActor, input: MarginInput): Promise<AdminResult> {
  const c = await check(input);
  if (!c.ok) return c;
  try {
    const rule = await db().serviceCountryMargin.create({ data: { serviceId: c.serviceId, countryId: c.countryId, minMargin: c.minMargin } });
    await repricePair(c.serviceId, c.countryId);
    await audit(actor, "pricing.margin_rule_created", { type: "margin_rule", id: String(rule.id) }, true, { pair: c.label, minMargin: c.minMargin }, `Custom minimum margin ${c.minMargin} for ${c.label}`);
    return { ok: true, message: `Custom margin saved for ${c.label}.` };
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }
}

export async function updateMarginRule(actor: AdminActor, id: number, input: MarginInput): Promise<AdminResult> {
  const before = await db().serviceCountryMargin.findUnique({ where: { id }, include: { service: { select: { name: true } }, country: { select: { name: true } } } });
  if (!before) return { ok: false, message: "Custom margin not found." };
  const c = await check(input);
  if (!c.ok) return c;
  try {
    await db().serviceCountryMargin.update({ where: { id }, data: { serviceId: c.serviceId, countryId: c.countryId, minMargin: c.minMargin } });
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }
  // The old pair falls back to the global margin; the new pair gets the rule.
  if (before.serviceId !== c.serviceId || before.countryId !== c.countryId) await repricePair(before.serviceId, before.countryId);
  await repricePair(c.serviceId, c.countryId);
  const oldLabel = `${before.service.name} · ${before.country.name}`;
  await audit(
    actor,
    "pricing.margin_rule_updated",
    { type: "margin_rule", id: String(id) },
    true,
    { pair: { from: oldLabel, to: c.label }, minMargin: { from: toDecimalString(toMinor(before.minMargin)), to: c.minMargin } },
    `Custom minimum margin for ${c.label} set to ${c.minMargin}`,
  );
  return { ok: true, message: `Custom margin updated for ${c.label}.` };
}

export async function deleteMarginRule(actor: AdminActor, id: number): Promise<AdminResult> {
  const rule = await db().serviceCountryMargin.findUnique({ where: { id }, include: { service: { select: { name: true } }, country: { select: { name: true } } } });
  if (!rule) return { ok: false, message: "Custom margin not found." };
  await db().serviceCountryMargin.delete({ where: { id } });
  await repricePair(rule.serviceId, rule.countryId);
  const label = `${rule.service.name} · ${rule.country.name}`;
  await audit(actor, "pricing.margin_rule_deleted", { type: "margin_rule", id: String(id) }, true, { pair: label, minMargin: toDecimalString(toMinor(rule.minMargin)) }, `Removed custom minimum margin for ${label} (global margin applies again)`);
  return { ok: true, message: `Custom margin removed. ${label} uses the global minimum margin again.` };
}
