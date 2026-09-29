import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/** Compact metric tile. */
export function Stat({ icon, label, value, hint, tone }: { icon: IconName; label: string; value: string; hint?: ReactNode; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "bad" ? "bg-danger-tint text-danger" : tone === "warn" ? "bg-accent-tint text-accent" : tone === "good" ? "bg-success-tint text-success" : "bg-primary-tint text-primary",
        )}
      >
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-fg-muted">{label}</p>
        <p className="truncate text-lg leading-tight font-semibold tabular-nums">{value}</p>
        {hint && <p className="truncate text-xs text-fg-subtle">{hint}</p>}
      </div>
    </div>
  );
}

/** Label/value grid for detail pages. */
export function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[170px_minmax(0,1fr)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-fg-muted">{k}</dt>
          <dd className="-mt-1.5 min-w-0 break-words sm:mt-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function YesNo({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return <Badge tone={value ? "success" : "neutral"}>{value ? yes : no}</Badge>;
}

const PROVIDER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  online: { label: "Online", tone: "success" },
  no_balance: { label: "Online · no balance", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
  auth_failed: { label: "Authentication failed", tone: "danger" },
  timeout: { label: "Timeout", tone: "danger" },
  rate_limited: { label: "Rate limited", tone: "warning" },
  not_configured: { label: "Not configured", tone: "neutral" },
};

export function ProviderStatusBadge({ status }: { status: string }) {
  const s = PROVIDER_STATUS[status] ?? PROVIDER_STATUS.unavailable;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const one = (v: string | string[] | undefined, max = 100) => (typeof v === "string" ? v.slice(0, max) : undefined);
export const pageParam = (v: string | string[] | undefined) => Math.min(10_000, Math.max(1, Number.parseInt(one(v) ?? "1", 10) || 1));

/** Link builder that keeps the current filters and swaps the page. */
export function pageHref(base: string, sp: Record<string, string | string[] | undefined>) {
  return (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") next.set(k, v);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };
}

export function UserStatusBadge({ status }: { status: "active" | "suspended" | "deleted" }) {
  return status === "active" ? <Badge tone="success">Active</Badge> : status === "suspended" ? <Badge tone="danger">Suspended</Badge> : <Badge tone="neutral">Deleted</Badge>;
}
