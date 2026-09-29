import "server-only";
import { toMinor } from "@/lib/money";
import { env } from "@/server/env";
import { pricingRules, type PricingRules } from "./pricing-rules";

/**
 * Currency configuration. One platform currency (wallets + customer prices),
 * plus the provider's billing currency and a manual FX rate between them.
 * Live FX conversion can replace providerToPlatform() later without touching callers.
 */
export type CurrencyInfo = { code: string };

export const platformCurrency = (): CurrencyInfo => ({ code: env().PLATFORM_CURRENCY });
export const providerCurrency = (): CurrencyInfo => ({ code: env().PROVIDER_CURRENCY });

const RATE_SCALE = 1_000_000n; // FX rate precision: 6 decimals
const BPS = 10_000n; // markup precision: basis points

/** Converts a decimal like 1.2345 / "20" into a scaled BigInt without floats. */
function scaled(value: number, scale: bigint): bigint {
  const [int, frac = ""] = value.toString().split(".");
  const digits = scale.toString().length - 1;
  return BigInt(int) * scale + BigInt(frac.padEnd(digits, "0").slice(0, digits));
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Provider-currency minor units → platform-currency minor units (rounded up). */
export function providerToPlatform(costMinor: number): number {
  if (env().PROVIDER_CURRENCY === env().PLATFORM_CURRENCY && env().PROVIDER_FX_RATE === 1) return costMinor;
  return Number(ceilDiv(BigInt(costMinor) * scaled(env().PROVIDER_FX_RATE, RATE_SCALE), RATE_SCALE));
}

/** Customer prices are rounded up to 0.001 of the platform currency. */
const PRICE_STEP = 10n;

/**
 * Customer price for a provider cost: cost × FX × (1 + markup%), and at least
 * cost + minimum margin. Integer math only.
 */
export function customerPrice(providerCostMinor: number, rules: PricingRules | null = pricingRules()): number {
  const cost = BigInt(providerToPlatform(providerCostMinor));
  const markupPercent = rules ? Number(rules.markupPercent) : env().PRICE_MARKUP_PERCENT;
  const minMargin = rules ? rules.minMargin : env().PRICE_MIN_MARGIN.toFixed(4);
  const markupBps = scaled(markupPercent, 100n); // 20 → 2000 bps
  const marked = ceilDiv(cost * (BPS + markupBps), BPS);
  const floor = cost + BigInt(toMinor(minMargin));
  const price = marked > floor ? marked : floor;
  return Number(ceilDiv(price, PRICE_STEP) * PRICE_STEP);
}
