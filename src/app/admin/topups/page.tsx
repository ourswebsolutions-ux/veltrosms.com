import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatus";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { resolveDateRange } from "@/lib/date-range";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { db } from "@/server/db";
import { requireAdminPage } from "@/server/admin/guard";
import { listAdminPayments } from "@/server/admin/orders";

export const metadata: Metadata = { title: "Top-ups" };

const STATUSES = { pending: "pending", approved: "paid", rejected: "rejected" } as const;

/** Manual Easypaisa / JazzCash top-up requests awaiting (or after) administrator review. */
export default async function AdminTopUpsPage({ searchParams }: PageProps<"/admin/topups">) {
  await requireAdminPage("/admin/topups");
  const sp = await searchParams;
  const q = one(sp.q);
  const statusKey = (Object.keys(STATUSES) as (keyof typeof STATUSES)[]).find((s) => s === (one(sp.status) ?? "pending")) ?? "pending";
  const all = one(sp.status) === "all";
  const range = resolveDateRange({ from: one(sp.from, 10), to: one(sp.to, 10) });
  const userId = /^[0-9a-f-]{36}$/.test(one(sp.userId) ?? "") ? one(sp.userId) : undefined;
  const [data, pendingCount] = await Promise.all([
    listAdminPayments({ provider: "manual", q, status: all ? undefined : STATUSES[statusKey], userId, from: range.from, to: range.to, page: pageParam(sp.page) }),
    db().payment.count({ where: { provider: "manual", status: "PENDING" } }),
  ]);

  return (
    <Card>
      <PageHeader title="Manual top-ups" description={`${pendingCount} waiting for verification · Easypaisa / JazzCash requests submitted by customers`} />
      <AdminFilters
        action="/admin/topups"
        active={Boolean(q || one(sp.status) || userId || range.preset !== "all")}
        fields={[
          ...(userId ? [{ kind: "hidden" as const, name: "userId", value: userId }] : []),
          { kind: "search", name: "q", placeholder: "Transaction ID, reference or customer email", value: q },
          {
            kind: "select",
            name: "status",
            label: "Status",
            value: all ? "all" : statusKey,
            options: [
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ],
          },
          { kind: "date", name: "from", label: "From", value: range.fromStr },
          { kind: "date", name: "to", label: "To", value: range.toStr },
        ]}
      />
      {range.error && <Alert tone="warning" className="mb-3">{range.error}</Alert>}
      <AdminTable
        rows={data.items}
        rowKey={(p) => p.id}
        empty={<EmptyState compact icon="wallet" title={!all && statusKey === "pending" ? "No requests waiting" : "No top-ups match"} />}
        columns={[
          {
            header: "Request",
            cell: (p) => (
              <Link href={`/admin/topups/${p.id}`} className="font-mono text-primary hover:underline">
                {p.reference}
              </Link>
            ),
          },
          { header: "Customer", cell: (p) => <Link href={`/admin/users/${p.user.id}`} className="block max-w-48 truncate hover:text-primary">{p.user.email}</Link> },
          { header: "Amount", className: "text-right font-semibold tabular-nums", cell: (p) => formatPrice(p.amount, p.currency) },
          { header: "Method", cell: (p) => (p.method === "jazzcash" ? "JazzCash" : "Easypaisa") },
          { header: "Transaction ID", className: "font-mono text-xs", cell: (p) => p.providerPaymentId ?? "—" },
          { header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} manual /> },
          { header: "Submitted", className: "whitespace-nowrap text-fg-muted", cell: (p) => formatShortDateTime(p.createdAt) },
          {
            header: "Reviewed",
            cell: (p) =>
              p.reviewedAt ? (
                <span className="block max-w-56 text-xs">
                  <span className="block text-fg-muted">
                    {formatShortDateTime(p.reviewedAt)} · {p.reviewedBy ?? "—"}
                  </span>
                  {p.rejectionReason && <span className="block truncate text-danger" title={p.rejectionReason}>{p.rejectionReason}</span>}
                </span>
              ) : (
                <span className="text-fg-subtle">—</span>
              ),
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/topups", sp)} />
    </Card>
  );
}
