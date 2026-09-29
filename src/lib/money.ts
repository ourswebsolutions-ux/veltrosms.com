/**
 * Money helpers shared by server and client.
 *
 * Amounts travel through the app as integer "minor units" of 1/10,000 of the
 * currency unit (e.g. 12_345 = 1.2345 USD). The database stores DECIMAL(18,4),
 * which converts exactly. No floating-point arithmetic is done on amounts.
 */
export const MONEY_SCALE = 10_000;
const DECIMALS = 4;

/** "12.3400" / "-0.5" / Prisma Decimal → 123400 / -5000. Exact (string-based). */
export function toMinor(value: { toString(): string } | string | number): number {
  const s = typeof value === "number" ? value.toFixed(DECIMALS) : value.toString();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!match) throw new Error(`Invalid money amount: ${s}`);
  const [, sign, int, frac = ""] = match;
  const minor = Number(int) * MONEY_SCALE + Number(frac.padEnd(DECIMALS, "0").slice(0, DECIMALS));
  if (!Number.isSafeInteger(minor)) throw new Error("Money amount out of range");
  return sign ? -minor : minor;
}

/** 123400 → "12.3400" (for DECIMAL columns). */
export function toDecimalString(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new Error("Money amount must be an integer number of minor units");
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / MONEY_SCALE)}.${String(abs % MONEY_SCALE).padStart(DECIMALS, "0")}`;
}

/**
 * Display an amount: "$12.34", "$0.026", "€3.50". Shows at least 2 decimals
 * and up to 4 when the amount has sub-cent precision (provider prices do).
 */
export function formatMoney(minor: number, currency = "USD"): string {
  const [int, frac] = toDecimalString(Math.abs(minor)).split(".");
  const trimmed = frac.replace(/0+$/, "");
  const fractionDigits = Math.max(2, trimmed.length);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  // Format the exact decimal string (no float rounding surprises).
  const text = formatter.format(Number(`${int}.${frac}`));
  return minor < 0 ? `−${text}` : text;
}

/** Parse user/admin input like "10", "10.5", "0.0025" into minor units. */
export function parseAmount(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(s)) return null;
  return toMinor(s);
}

/**
 * Top-up fee: `feeBps` basis points of the amount, rounded up to a whole
 * cent, plus a fixed part. Integer math only. The server's result is the one
 * charged; clients use this for the preview.
 */
export function topUpFeeFor(amount: number, feeBps: number, feeFixed: number): number {
  const cent = BigInt(MONEY_SCALE / 100);
  let percent = (BigInt(amount) * BigInt(feeBps) + 9_999n) / 10_000n;
  percent = ((percent + cent - 1n) / cent) * cent;
  return Number(percent) + feeFixed;
}
