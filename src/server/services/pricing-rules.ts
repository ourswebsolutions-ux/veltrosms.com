import "server-only";
import { getSetting } from "./settings.service";

/**
 * The markup rule used by customerPrice(): a percentage over provider cost
 * with a minimum margin. Admins edit it (Admin → Pricing); env values are the
 * defaults. customerPrice() is synchronous, so price-computing entry points
 * call loadPricingRules() first; the cached rule is refreshed every few seconds.
 */

export type PricingRules = { markupPercent: string; minMargin: string };

let current: PricingRules | null = null;

export async function loadPricingRules(): Promise<PricingRules> {
  const s = await getSetting("pricing");
  current = { markupPercent: s.markupPercent, minMargin: s.minMargin };
  return current;
}

/** The last loaded rule, or null before the first load (callers fall back to env). */
export function pricingRules(): PricingRules | null {
  return current;
}

/** Tests / after saving. */
export function setPricingRules(rules: PricingRules | null) {
  current = rules;
}
