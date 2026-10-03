import { formatPrice, ltr } from "./format";
import { formatMoney, MONEY_SCALE } from "./money";

/**
 * Website-wide DISPLAY currency. Every amount is stored and charged in the
 * platform currency (USD); the visitor's choice here only changes how amounts
 * are shown ("≈ Rs 554"). Converted values are never sent to the server.
 *
 * To add a currency: list it here (code, name, symbol) and, if wanted, add a
 * DISPLAY_<CODE>_RATE override in the server environment.
 */
export const DISPLAY_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs ", locale: "en-US" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", locale: "en-US" },
] as const;

export type DisplayCurrencyCode = (typeof DISPLAY_CURRENCIES)[number]["code"];
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrencyCode = "USD";

export const isDisplayCurrency = (v: unknown): v is DisplayCurrencyCode => DISPLAY_CURRENCIES.some((c) => c.code === v);
export const displayCurrencyInfo = (code: DisplayCurrencyCode) => DISPLAY_CURRENCIES.find((c) => c.code === code)!;

export type DisplayRate = {
  currency: DisplayCurrencyCode;
  /**
   * EFFECTIVE rate: units of `currency` per 1 unit of the base (platform)
   * currency, i.e. exchange rate + the admin's conversion tax/markup. This is
   * the only rate used to show converted amounts.
   */
  rate: number;
  /** The exchange rate before the markup (configured or live). */
  baseRate: number;
  /** Admin conversion tax / markup added to the rate (0 = none). */
  markup: number;
  /** "configured" = fixed operator rate (DISPLAY_<CODE>_RATE); "live" = public exchange-rate feed. */
  source: "configured" | "live";
  /** When the live rate was published (null for a configured rate). */
  updatedAt: string | null;
};

/** Rates from the base currency to every display currency that currently has one. */
export type DisplayRates = {
  /** The platform currency all amounts are stored and charged in. */
  base: string;
  rates: Partial<Record<DisplayCurrencyCode, DisplayRate>>;
};

/**
 * Converts base-currency minor units for display, e.g. 20000 (= $2.00) at
 * 276.98 PKR → "Rs 554". Whole units from 10 up, two decimals below
 * ("₹2.52"). Signed amounts keep their sign ("−Rs 554").
 */
export function formatConverted(minorUnits: number, rate: Pick<DisplayRate, "currency" | "rate">, opts: { signed?: boolean } = {}): string {
  const info = displayCurrencyInfo(rate.currency);
  // Exact decimal arithmetic: amount (1/10,000 units) × rate (1/1,000,000 units) as integers,
  // rounded half-up to cents — so $10 at 287 is exactly "2,870", never 2869.999….
  const cents = convertToCents(Math.abs(minorUnits), rate.rate);
  const digits = cents !== BigInt(0) && cents < BigInt(1000) ? 2 : 0;
  const shown = digits === 2 ? cents : ((cents + BigInt(50)) / BigInt(100)) * BigInt(100);
  const whole = shown / BigInt(100);
  const fraction = String(shown % BigInt(100)).padStart(2, "0");
  const number = new Intl.NumberFormat(info.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    `${whole}.${fraction}` as unknown as number, // Intl formats decimal strings exactly
  );
  const sign = minorUnits < 0 ? "−" : opts.signed ? "+" : "";
  return ltr(`${sign}${info.symbol}${number}`);
}

const RATE_SCALE = 1_000_000;

/** Rate as an integer of 1/1,000,000 units (rates are stored with at most 6 decimals). */
export const rateToMicro = (rate: number) => Math.round(rate * RATE_SCALE);

/** Effective rate = exchange rate + conversion tax/markup, added in exact decimal steps. */
export const effectiveRate = (baseRate: number, markup: number) => (rateToMicro(baseRate) + rateToMicro(markup)) / RATE_SCALE;

/** minorUnits (1/10,000 of the base currency) × rate, in hundredths of the display currency, rounded half-up. */
export function convertToCents(minorUnits: number, rate: number): bigint {
  const product = BigInt(Math.round(minorUnits)) * BigInt(rateToMicro(rate)); // 1e-4 × 1e-6 = 1e-10 units
  const divisor = BigInt(MONEY_SCALE * RATE_SCALE / 100); // → hundredths
  return (product + divisor / BigInt(2)) / divisor;
}

/** The original (charged) amount, e.g. "$2.00" or "+$2.00". */
export function formatOriginal(minorUnits: number, currency: string, opts: { signed?: boolean } = {}): string {
  if (!opts.signed) return formatPrice(minorUnits, currency);
  return ltr(`${minorUnits >= 0 ? "+" : "−"}${formatMoney(Math.abs(minorUnits), currency)}`);
}
