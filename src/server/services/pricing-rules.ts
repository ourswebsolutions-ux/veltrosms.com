import "server-only";
import { toDecimalString, toMinor } from "@/lib/money";
import { db } from "@/server/db";
import { getSetting } from "./settings.service";

/**
 * The pricing rules used by customerPrice():
 *  - the GLOBAL rule (Admin → Pricing): a markup percentage over provider cost
 *    with a minimum margin, for every service and country;
 *  - per service + country EXCEPTIONS (Admin → Custom Margins): a minimum
 *    margin that replaces the global one for that pair only.
 * customerPrice() is synchronous, so price-computing entry points call
 * loadPricingRules() first; both are cached and refreshed every few seconds.
 */

export type PricingRules = { markupPercent: string; minMargin: string };

let current: PricingRules | null = null;

const MARGINS_TTL_MS = 15_000;
let margins: { map: Map<string, string>; at: number } | null = null;
const pairKey = (serviceId: number, countryId: number) => `${serviceId}:${countryId}`;

async function loadMarginRules(): Promise<void> {
  if (margins && Date.now() - margins.at < MARGINS_TTL_MS) return;
  const rows = await db().serviceCountryMargin.findMany({ select: { serviceId: true, countryId: true, minMargin: true } });
  margins = { map: new Map(rows.map((r) => [pairKey(r.serviceId, r.countryId), toDecimalString(toMinor(r.minMargin))])), at: Date.now() };
}

export async function loadPricingRules(): Promise<PricingRules> {
  const [s] = await Promise.all([getSetting("pricing"), loadMarginRules()]);
  current = { markupPercent: s.markupPercent, minMargin: s.minMargin };
  return current;
}

/** The last loaded rule, or null before the first load (callers fall back to env). */
export function pricingRules(): PricingRules | null {
  return current;
}

/** Custom minimum margin for one service + country (as a decimal string), or null to use the global one. */
export function marginOverride(serviceId: number, countryId: number): string | null {
  return margins?.map.get(pairKey(serviceId, countryId)) ?? null;
}

/** Tests / after saving. */
export function setPricingRules(rules: PricingRules | null) {
  current = rules;
}

/** Forces the custom margins to be re-read on the next loadPricingRules() (after an admin change). */
export function invalidateMarginRules() {
  margins = null;
}
