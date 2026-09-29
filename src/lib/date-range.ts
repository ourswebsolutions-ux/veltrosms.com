/**
 * Date-range filters for history and statistics ("today", "last 7 days", a
 * custom range…). Days are UTC days — the same days the database groups by —
 * and every input is validated here before it reaches a query.
 */

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export type DateRange = {
  preset: RangePreset | "custom" | "all";
  from?: Date;
  to?: Date;
  /** YYYY-MM-DD, for form inputs. */
  fromStr?: string;
  toStr?: string;
  label: string;
  /** Set when the requested custom range was invalid (the range is then "all"). */
  error?: string;
};

const DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string): Date | null {
  if (!ISO_DAY.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const endOfDay = (d: Date) => new Date(d.getTime() + DAY - 1);
const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function resolveDateRange(input: { range?: string; from?: string; to?: string }, now = new Date()): DateRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const preset = RANGE_PRESETS.find((p) => p.value === input.range);
  if (preset) {
    const from =
      preset.value === "today"
        ? today
        : preset.value === "7d"
          ? new Date(today.getTime() - 6 * DAY)
          : preset.value === "30d"
            ? new Date(today.getTime() - 29 * DAY)
            : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { preset: preset.value, from, to: endOfDay(today), fromStr: dayStr(from), toStr: dayStr(today), label: preset.label };
  }

  const fromRaw = input.from?.trim() || undefined;
  const toRaw = input.to?.trim() || undefined;
  if (!fromRaw && !toRaw) return { preset: "all", label: "All time" };
  const from = fromRaw ? parseDay(fromRaw) : null;
  const to = toRaw ? parseDay(toRaw) : null;
  if ((fromRaw && !from) || (toRaw && !to)) return { preset: "all", label: "All time", error: "Enter dates as YYYY-MM-DD." };
  if (from && to && from > to) return { preset: "all", label: "All time", error: "The start date must be on or before the end date." };
  return {
    preset: "custom",
    from: from ?? undefined,
    to: to ? endOfDay(to) : undefined,
    fromStr: from ? dayStr(from) : undefined,
    toStr: to ? dayStr(to) : undefined,
    label: from && to ? `${fmt(from)} – ${fmt(to)}` : from ? `Since ${fmt(from)}` : `Until ${fmt(to!)}`,
  };
}
