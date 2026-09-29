import { formatMoney } from "./money";

const qtyFormatter = new Intl.NumberFormat("en-US");

/** Money display; amounts are integer minor units (see lib/money). */
export function formatPrice(minorUnits: number, currency = "USD"): string {
  return formatMoney(minorUnits, currency);
}

export function formatQty(qty: number): string {
  return `${qtyFormatter.format(qty)} qty`;
}

/** Provider numbers are digits with the country code: "15550001000" → "+15550001000". */
export function formatPhone(phone: string): string {
  return /^\d+$/.test(phone) ? `+${phone}` : phone;
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
