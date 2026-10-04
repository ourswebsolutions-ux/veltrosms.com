import { formatMoney } from "./money";

/**
 * Values that must read left-to-right in every language (prices, phone
 * numbers, signed amounts) are wrapped in Unicode directional isolates
 * (LRI … PDI). They are invisible in left-to-right text; in Urdu they keep
 * "+92 300…" or "−$2.50" in their natural order.
 */
export const ltr = (s: string) => `\u2066${s}\u2069`;
/** Removes the isolates again (e.g. before copying to the clipboard). */
export const stripBidi = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

const qtyFormatter = new Intl.NumberFormat("en-US");

/** Money display; amounts are integer minor units (see lib/money). */
export function formatPrice(minorUnits: number, currency = "USD"): string {
  return ltr(formatMoney(minorUnits, currency));
}

/** Grouped number without a unit ("17,243,194"); customer UI adds a translated unit. */
export function formatCount(n: number): string {
  return ltr(qtyFormatter.format(n));
}

/**
 * Compact count for narrow screens: below 1,000 as-is, otherwise whole
 * thousands + "K", rounded down so stock is never overstated
 * (1,000 → "1K", 12,000 → "12K", 17,923,220 → "17,923K", 999 → "999").
 */
export function formatCountCompact(n: number): string {
  if (Math.abs(n) < 1000) return formatCount(n);
  return ltr(`${qtyFormatter.format(Math.trunc(n / 1000))}K`);
}

export function formatQty(qty: number): string {
  return `${qtyFormatter.format(qty)} qty`;
}

/** Provider numbers are digits with the country code: "15550001000" → "+15550001000". */
/**
 * A purchased number in international form ("+923001234567"). Providers return
 * digits only (stored as-is); this is the single place the "+" is added, used
 * both for display and for the Copy button so the clipboard matches the screen.
 */
export function internationalPhone(phone: string): string {
  const p = phone.trim();
  if (p.startsWith("+")) return `+${p.slice(1).replace(/\D/g, "")}`;
  const digits = p.replace(/[\s().-]/g, "");
  return /^\d+$/.test(digits) ? `+${digits}` : p;
}

/** Display form (bidi-isolated, so it reads left-to-right inside Urdu text). */
export function formatPhone(phone: string): string {
  return ltr(internationalPhone(phone));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Compact form for dense tables: "Sep 26, 8:20 AM" (year only if not current). */
export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}
