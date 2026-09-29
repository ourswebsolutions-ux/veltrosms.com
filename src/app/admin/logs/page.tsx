import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/Tabs";
import { resolveDateRange } from "@/lib/date-range";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { listLogs, type LogKind } from "@/server/admin/platform";

export const metadata: Metadata = { title: "System logs" };

const KINDS: { value: LogKind; label: string; hint: string }[] = [
  { value: "security", label: "Security", hint: "Logins, failed logins, password and email changes" },
  { value: "provider", label: "Provider failures", hint: "Search by action, error category or order ID" },
  { value: "payments", label: "Payment events", hint: "Webhook deliveries; search by event, type or reference" },
  { value: "wallet", label: "Wallet adjustments", hint: "Manual balance changes; search by reason or user email" },
];

export default async function AdminLogsPage({ searchParams }: PageProps<"/admin/logs">) {
  await requireAdminPage("/admin/logs");
  const sp = await searchParams;
  const kind = KINDS.find((k) => k.value === one(sp.kind))?.value ?? "security";
  const q = one(sp.q);
  const range = resolveDateRange({ from: one(sp.from, 10), to: one(sp.to, 10) });
  const data = await listLogs(kind, { q, from: range.from, to: range.to, page: pageParam(sp.page) });
  const meta = KINDS.find((k) => k.value === kind)!;

  return (
    <Card>
      <PageHeader title="System logs" description="Security events, provider failures, payment webhooks and wallet adjustments. Admin actions are in Audit logs." />
      <UnderlineTabs
        label="Log type"
        activeHref={kind === "security" ? "/admin/logs" : `/admin/logs?kind=${kind}`}
        items={KINDS.map((k) => ({ href: k.value === "security" ? "/admin/logs" : `/admin/logs?kind=${k.value}`, label: k.label }))}
        className="mb-4"
      />
      <AdminFilters
        action="/admin/logs"
        active={Boolean(q || range.preset !== "all")}
        fields={[
          { kind: "hidden", name: "kind", value: kind },
          { kind: "search", name: "q", placeholder: meta.hint, value: q },
          { kind: "date", name: "from", label: "From", value: range.fromStr },
          { kind: "date", name: "to", label: "To", value: range.toStr },
        ]}
      />
      {range.error && <Alert tone="warning" className="mb-3">{range.error}</Alert>}
      {data.items.length === 0 ? (
        <EmptyState compact icon="history" title="No log entries" description={q || range.preset !== "all" ? "Try other filters." : "Entries appear as things happen."} />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {data.items.map((r) => (
            <li key={r.id} className="grid gap-1 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
              <time className="text-xs text-fg-subtle tabular-nums sm:pt-0.5" dateTime={r.at}>
                {formatDateTime(r.at)}
              </time>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  {r.level !== "info" && <Badge tone={r.level === "error" ? "danger" : "warning"}>{r.level}</Badge>}
                  {r.link ? (
                    <Link href={r.link} className="font-medium hover:text-primary">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.title}</span>
                  )}
                  {r.subject && <span className="text-fg-muted">{r.subject}</span>}
                </p>
                {r.detail && <p className="mt-0.5 font-mono text-xs break-all text-fg-subtle">{r.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/logs", sp)} />
    </Card>
  );
}
