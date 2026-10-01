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
  /** Units of `currency` per 1 unit of the base (platform) currency. */
  rate: number;
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
export function formatConverted(minorUnits: number, rate: DisplayRate, opts: { signed?: boolean } = {}): string {
  const info = displayCurrencyInfo(rate.currency);
  const value = (Math.abs(minorUnits) / MONEY_SCALE) * rate.rate;
  const digits = value !== 0 && value < 10 ? 2 : 0;
  const number = new Intl.NumberFormat(info.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const sign = minorUnits < 0 ? "−" : opts.signed ? "+" : "";
  return ltr(`${sign}${info.symbol}${number}`);
}

/** The original (charged) amount, e.g. "$2.00" or "+$2.00". */
export function formatOriginal(minorUnits: number, currency: string, opts: { signed?: boolean } = {}): string {
  if (!opts.signed) return formatPrice(minorUnits, currency);
  return ltr(`${minorUnits >= 0 ? "+" : "−"}${formatMoney(Math.abs(minorUnits), currency)}`);
}
