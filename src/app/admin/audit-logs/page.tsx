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
import { resolveDateRange } from "@/lib/date-range";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { listAuditLogs } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Audit logs" };

const TARGETS = ["user", "payment", "order", "setting", "country", "service"] as const;
const LINK: Record<string, string> = { user: "/admin/users/", payment: "/admin/payments/", order: "/admin/orders/" };

/** Every sensitive admin action with its outcome. Append-only (database triggers); secrets are never stored. */
export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  await requireAdminPage("/admin/audit-logs");
  const sp = await searchParams;
  const q = one(sp.q);
  const actor = one(sp.actor);
  const action = one(sp.action, 64);
  const targetType = TARGETS.find((t) => t === one(sp.target));
  const outcome = one(sp.outcome);
  const range = resolveDateRange({ from: one(sp.from, 10), to: one(sp.to, 10) });
  const data = await listAuditLogs({
    q,
    actor,
    action,
    targetType,
    success: outcome === "ok" ? true : outcome === "failed" ? false : undefined,
    from: range.from,
    to: range.to,
    page: pageParam(sp.page),
  });

  return (
    <Card>
      <PageHeader title="Audit logs" description={`${data.total.toLocaleString("en-US")} entries · who did what, to what, and whether it succeeded`} />
      <AdminFilters
        action="/admin/audit-logs"
        active={Boolean(q || actor || action || targetType || outcome || range.preset !== "all")}
        fields={[
          { kind: "search", name: "q", placeholder: "Description, action or target ID", value: q },
          { kind: "text", name: "actor", label: "Admin email", placeholder: "admin@…", value: actor },
          { kind: "select", name: "action", label: "Action", value: action, options: [{ value: "", label: "All actions" }, ...data.actions.map((a) => ({ value: a, label: a }))] },
          { kind: "select", name: "target", label: "Target", value: targetType, options: [{ value: "", label: "Any target" }, ...TARGETS.map((t) => ({ value: t, label: t }))] },
          { kind: "select", name: "outcome", label: "Outcome", value: outcome, options: [{ value: "", label: "Any" }, { value: "ok", label: "Succeeded" }, { value: "failed", label: "Refused / failed" }] },
          { kind: "date", name: "from", label: "From", value: range.fromStr },
          { kind: "date", name: "to", label: "To", value: range.toStr },
        ]}
      />
      {range.error && <Alert tone="warning" className="mb-3">{range.error}</Alert>}
      {data.items.length === 0 ? (
        <EmptyState compact icon="shield" title="No audit entries match" />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {data.items.map((r) => (
            <li key={r.id} className="grid gap-1 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
              <time className="text-xs text-fg-subtle tabular-nums" dateTime={r.createdAt}>
                {formatDateTime(r.createdAt)}
              </time>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  {!r.success && <Badge tone="danger">Refused</Badge>}
                  <span className="font-medium">{r.description ?? r.action}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                  <span className="font-mono">{r.action}</span>
                  <span>by {r.actorEmail ?? "system"}</span>
                  {r.targetType && r.targetId && (
                    LINK[r.targetType] ? (
                      <Link href={`${LINK[r.targetType]}${r.targetId}`} className="text-primary hover:underline">
                        {r.targetType} {r.targetId.slice(0, 8)}
                      </Link>
                    ) : (
                      <span>
                        {r.targetType} {r.targetId}
                      </span>
                    )
                  )}
                  {r.ip && <span>IP {r.ip}</span>}
                </p>
                {r.metadata != null && <p className="mt-0.5 font-mono text-xs break-all text-fg-subtle">{JSON.stringify(r.metadata).slice(0, 240)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/audit-logs", sp)} />
    </Card>
  );
}
