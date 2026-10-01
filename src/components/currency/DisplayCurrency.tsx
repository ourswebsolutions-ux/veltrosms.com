"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_DISPLAY_CURRENCY,
  displayCurrencyInfo,
  formatConverted,
  formatOriginal,
  isDisplayCurrency,
  type DisplayCurrencyCode,
  type DisplayRate,
  type DisplayRates,
} from "@/lib/display-currency";
import { usePref } from "@/lib/preferences";

/** Per-browser display currency (USD unless the visitor picks another). */
export const CURRENCY_KEY = "ui-currency";

const RatesContext = createContext<DisplayRates | null>(null);

/** Supplies the server's display rates to every price on the page (root layout). */
export function DisplayCurrencyProvider({ rates, children }: { rates: DisplayRates; children: ReactNode }) {
  return <RatesContext.Provider value={rates}>{children}</RatesContext.Provider>;
}

export type DisplayCurrency = {
  /** What the visitor chose. */
  selected: DisplayCurrencyCode;
  setSelected: (code: DisplayCurrencyCode) => void;
  /** Platform currency every amount is stored and charged in. */
  base: string;
  rates: DisplayRates["rates"];
  /** The rate in use, or null when showing the original currency (chosen, or no rate available). */
  rate: DisplayRate | null;
  /** Converted text for a base-currency amount, or null when nothing should be converted. */
  convert: (minorUnits: number, currency: string, opts?: { signed?: boolean }) => string | null;
};

export function useDisplayCurrency(): DisplayCurrency {
  const ctx = useContext(RatesContext) ?? { base: "USD", rates: {} };
  const [pref, setPref] = usePref(CURRENCY_KEY);
  const selected = isDisplayCurrency(pref) ? pref : DEFAULT_DISPLAY_CURRENCY;
  const rate = selected !== ctx.base ? (ctx.rates[selected] ?? null) : null;
  const convert = useCallback(
    (minorUnits: number, currency: string, opts?: { signed?: boolean }) =>
      rate && currency === ctx.base ? formatConverted(minorUnits, rate, opts) : null,
    [rate, ctx.base],
  );
  return useMemo(
    () => ({ selected, setSelected: (code) => setPref(code), base: ctx.base, rates: ctx.rates, rate, convert }),
    [selected, setPref, ctx.base, ctx.rates, rate, convert],
  );
}

/**
 * Every customer-facing amount. Stored/charged amounts are in the platform
 * currency; with another display currency selected the converted value is
 * shown as an approximation ("≈ Rs 554").
 *  - "auto":  converted value only, with the original in the tooltip (prices in lists).
 *  - "stack": original, with the approximate value underneath (tables, history).
 *  - "both":  original followed by the approximate value (balances, charges).
 */
export function Money({
  amount,
  currency,
  variant = "auto",
  signed,
  className,
  approxClassName,
}: {
  amount: number;
  currency: string;
  variant?: "auto" | "stack" | "both";
  signed?: boolean;
  className?: string;
  approxClassName?: string;
}) {
  const { convert } = useDisplayCurrency();
  const original = formatOriginal(amount, currency, { signed });
  const converted = convert(amount, currency, { signed });
  if (!converted) return <span className={className}>{original}</span>;
  const approx = `≈ ${converted}`;
  const title = `${original} (${currency}) is the actual amount; ${converted} is approximate`;
  if (variant === "auto") {
    return (
      <span className={className} title={title}>
        {approx}
      </span>
    );
  }
  if (variant === "stack") {
    return (
      <span className={cn("inline-flex flex-col", className)} title={title}>
        <span>{original}</span>
        <span className={cn("text-xs font-normal text-fg-muted", approxClassName)}>{approx}</span>
      </span>
    );
  }
  return (
    <span className={className} title={title}>
      {original}
      <span className={cn("ml-1.5 text-[0.85em] font-normal text-fg-muted", approxClassName)}>{approx}</span>
    </span>
  );
}

/** Label for the approximate row in purchase dialogs, e.g. "Approx. INR". */
export function useApproxLabel(): string | null {
  const { rate } = useDisplayCurrency();
  return rate ? `Approx. ${displayCurrencyInfo(rate.currency).code}` : null;
}

/**
 * Price rows for purchase dialogs (inside a <dl>). With a non-base display
 * currency: Original price · Approx. XXX · You will be charged. The charge is
 * always the original amount; the converted value is informational only.
 */
export function ChargeRows({ amount, currency, priceClassName = "font-semibold text-primary tabular-nums" }: { amount: number; currency: string; priceClassName?: string }) {
  const { convert, rate } = useDisplayCurrency();
  const original = formatOriginal(amount, currency);
  const converted = convert(amount, currency);
  if (!converted || !rate) {
    return (
      <>
        <dt className="text-fg-muted">Price</dt>
        <dd className={priceClassName}>{original}</dd>
      </>
    );
  }
  return (
    <>
      <dt className="text-fg-muted">Original price</dt>
      <dd className={priceClassName}>{original}</dd>
      <dt className="text-fg-muted">Approx. {rate.currency}</dt>
      <dd className="tabular-nums">
        {converted}
        <span className="block text-xs text-fg-muted">For reference only — exchange rates change.</span>
      </dd>
      <dt className="text-fg-muted">You will be charged</dt>
      <dd className="font-semibold tabular-nums">
        {original} <span className="font-normal text-fg-muted">({currency})</span>
      </dd>
    </>
  );
}
