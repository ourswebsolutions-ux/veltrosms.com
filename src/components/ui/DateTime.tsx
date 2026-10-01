"use client";

import { useLocale } from "@/i18n/client";
import { intlLocale } from "@/i18n/config";
import { formatDateTime, formatShortDateTime, ltr } from "@/lib/format";

/**
 * A date and time in the visitor's language ("Oct 1, 2026, 6:36 PM",
 * "১ অক্টো, ২০২৬, ৬:৩৬ PM", …). English keeps the existing format exactly.
 */
export function DateTime({ iso, short = false }: { iso: string; short?: boolean }) {
  const { locale } = useLocale();
  let text: string;
  if (locale === "en") text = short ? formatShortDateTime(iso) : formatDateTime(iso);
  else {
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    text = d.toLocaleString(
      intlLocale(locale),
      short
        ? { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit" }
        : { dateStyle: "medium", timeStyle: "short" },
    );
  }
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {ltr(text)}
    </time>
  );
}
