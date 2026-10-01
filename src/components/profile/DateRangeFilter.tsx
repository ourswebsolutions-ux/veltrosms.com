import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { RANGE_PRESETS, type DateRange } from "@/lib/date-range";
import { getT } from "@/i18n/server";

/**
 * Quick ranges (links) plus a custom from/to form (plain GET, works without
 * JavaScript). `keep` holds the page's other query parameters (e.g. the tab).
 */
export async function DateRangeFilter({
  range,
  basePath,
  keep = {},
  showCustom = true,
  className,
}: {
  range: DateRange;
  basePath: string;
  keep?: Record<string, string>;
  showCustom?: boolean;
  className?: string;
}) {
  const t = await getT();
  const href = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ ...keep, ...extra }).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-[13px] font-medium whitespace-nowrap transition-colors",
      active ? "border-primary bg-primary-tint text-primary" : "border-line text-fg-muted hover:border-primary-tint-border hover:text-fg",
    );

  return (
    <div className={cn("space-y-3", className)}>
      <nav aria-label={t("range.label")} className="flex flex-wrap gap-2">
        <Link href={href({})} className={chip(range.preset === "all")} aria-current={range.preset === "all" ? "true" : undefined}>
          {t("range.all")}
        </Link>
        {RANGE_PRESETS.map((p) => (
          <Link key={p.value} href={href({ range: p.value })} className={chip(range.preset === p.value)} aria-current={range.preset === p.value ? "true" : undefined}>
            {t(`range.${p.value}`)}
          </Link>
        ))}
      </nav>
      {showCustom && (
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-2" aria-label={t("range.custom")}>
          {Object.entries(keep).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="grid gap-1 text-xs text-fg-muted">
            {t("history.from")}
            <Input type="date" name="from" defaultValue={range.preset === "custom" ? range.fromStr : ""} className="h-9 min-w-0 px-3 text-sm" />
          </label>
          <label className="grid gap-1 text-xs text-fg-muted">
            {t("history.to")}
            <Input type="date" name="to" defaultValue={range.preset === "custom" ? range.toStr : ""} className="h-9 min-w-0 px-3 text-sm" />
          </label>
          <Button type="submit" size="sm" variant="outline" className="h-9">
            {t("range.apply")}
          </Button>
        </form>
      )}
      {range.error && (
        <Alert tone="warning">
          {t.server(range.error)} {t("range.showingAll")}
        </Alert>
      )}
    </div>
  );
}
