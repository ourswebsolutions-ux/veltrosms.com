import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { env } from "@/server/env";
import { DISPLAY_CURRENCIES, type DisplayCurrencyCode, type DisplayRate, type DisplayRates } from "@/lib/display-currency";
import { platformCurrency } from "./currency";

/**
 * Exchange rates for DISPLAY ONLY (the website currency selector). Nothing
 * here is ever used to charge a wallet: every purchase is priced from the
 * database in the platform currency.
 *
 * Per display currency, in order:
 *   1. DISPLAY_<CODE>_RATE (fixed, set by the operator), e.g. DISPLAY_PKR_RATE;
 *   2. a live rate from EXCHANGE_RATES_URL (public, no key). One request
 *      returns every currency; it is cached for 6 h and refreshed in the
 *      background, and the last good rates are kept for up to 3 days if the
 *      feed is down;
 *   3. otherwise no rate: that currency is shown as unavailable and prices
 *      stay in the platform currency. A rate is never invented.
 */

const TTL_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 3 * 24 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5000;

const ApiSchema = z.object({
  result: z.literal("success"),
  base_code: z.string(),
  time_last_update_unix: z.number(),
  rates: z.record(z.string(), z.number().positive()),
});

type Live = { base: string; rates: Record<string, number>; updatedAt: string; fetchedAt: number };
let live: Live | null = null;
let lastFailureAt = 0;
let inflight: Promise<void> | null = null;

async function refresh(base: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${env().EXCHANGE_RATES_URL}${encodeURIComponent(base)}`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = ApiSchema.parse(await res.json());
    if (data.base_code !== base) throw new Error("unexpected base currency");
    live = { base, rates: data.rates, updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(), fetchedAt: Date.now() };
  } catch (error) {
    // Next.js signals (e.g. "this route is dynamic" during prerendering) are not feed failures.
    unstable_rethrow(error);
    lastFailureAt = Date.now();
    console.warn("[exchange-rates] couldn't refresh display rates:", error instanceof Error ? error.message : "unknown error");
  } finally {
    clearTimeout(timer);
  }
}

const fixedRate = (code: DisplayCurrencyCode): number | undefined =>
  ({ PKR: env().DISPLAY_PKR_RATE, INR: env().DISPLAY_INR_RATE, BDT: env().DISPLAY_BDT_RATE }) [code as "PKR" | "INR" | "BDT"];

async function liveRates(base: string, needed: boolean): Promise<Live | null> {
  const now = Date.now();
  const usable = live && live.base === base && now - live.fetchedAt < STALE_MS ? live : null;
  const fresh = usable && now - usable.fetchedAt < TTL_MS;
  if (needed && !fresh && now - lastFailureAt > RETRY_MS) {
    inflight ??= refresh(base).finally(() => (inflight = null));
    // Serve slightly old rates at once and refresh in the background; only wait when there is nothing yet.
    if (!usable) await inflight;
    else inflight.catch(() => {});
  }
  return live && live.base === base && Date.now() - live.fetchedAt < STALE_MS ? live : null;
}

/** Rates from the platform currency to each display currency that has one right now. */
export async function getDisplayRates(): Promise<DisplayRates> {
  const base = platformCurrency().code;
  const rates: DisplayRates["rates"] = {};
  const targets = DISPLAY_CURRENCIES.map((c) => c.code).filter((c) => c !== base);
  const needLive = targets.some((c) => !fixedRate(c));
  const feed = await liveRates(base, needLive);
  for (const code of targets) {
    const fixed = fixedRate(code);
    let rate: DisplayRate | null = null;
    if (fixed) rate = { currency: code, rate: fixed, source: "configured", updatedAt: null };
    else if (feed?.rates[code]) rate = { currency: code, rate: feed.rates[code], source: "live", updatedAt: feed.updatedAt };
    if (rate) rates[code] = rate;
  }
  return { base, rates };
}

/** For tests. */
export function resetExchangeRateCache() {
  live = null;
  lastFailureAt = 0;
  inflight = null;
}
