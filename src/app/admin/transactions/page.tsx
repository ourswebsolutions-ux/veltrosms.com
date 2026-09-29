import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { resolveDateRange } from "@/lib/date-range";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { listLedger } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Transactions" };

const TYPES = ["deposit", "purchase", "refund", "adjustment"] as const;

/** The complete, append-only financial ledger. Entries are never edited or deleted. */
export default async function AdminTransactionsPage({ searchParams }: PageProps<"/admin/transactions">) {
  await requireAdminPage("/admin/transactions");
  const sp = await searchParams;
  const q = one(sp.q);
  const type = TYPES.find((t) => t === one(sp.type));
  const userId = /^[0-9a-f-]{36}$/.test(one(sp.userId) ?? "") ? one(sp.userId) : undefined;
  const range = resolveDateRange({ from: one(sp.from, 10), to: one(sp.to, 10) });
  const data = await listLedger({ q, type, userId, from: range.from, to: range.to, page: pageParam(sp.page) });

  return (
    <Card>
      <PageHeader title="Transactions" description={`${data.total.toLocaleString("en-US")} ledger entries · append-only (corrections are new adjustments)`} />
      <AdminFilters
        action="/admin/transactions"
        active={Boolean(q || type || userId || range.preset !== "all")}
        fields={[
          ...(userId ? [{ kind: "hidden" as const, name: "userId", value: userId }] : []),
          { kind: "search", name: "q", placeholder: "Customer email, description, reference or ID", value: q },
          { kind: "select", name: "type", label: "Type", value: type, options: [{ value: "", label: "All types" }, ...TYPES.map((t) => ({ value: t, label: TRANSACTION_LABEL[t] }))] },
          { kind: "date", name: "from", label: "From", value: range.fromStr },
          { kind: "date", name: "to", label: "To", value: range.toStr },
        ]}
      />
      {userId && <Alert className="mb-3">Showing one customer&apos;s entries.</Alert>}
      {range.error && <Alert tone="warning" className="mb-3">{range.error}</Alert>}
      <AdminTable
        rows={data.items}
        rowKey={(t) => t.id}
        empty={<EmptyState compact icon="history" title="No transactions match" />}
        columns={[
          {
            header: "Date / ID",
            className: "whitespace-nowrap",
            cell: (t) => (
              <>
                <span className="block text-fg-muted">{formatShortDateTime(t.createdAt)}</span>
                <span className="font-mono text-xs text-fg-subtle">{t.id.slice(0, 8)}</span>
              </>
            ),
          },
          { header: "Customer", cell: (t) => <Link href={`/admin/users/${t.userId}`} className="block max-w-44 truncate hover:text-primary">{t.email}</Link> },
          { header: "Type", cell: (t) => TRANSACTION_LABEL[t.type] },
          {
            header: "Amount",
            className: "text-right tabular-nums",
            cell: (t) => (
              <span className={cn("font-medium", t.amount >= 0 && "text-success")}>
                {t.amount >= 0 ? "+" : "−"}
                {formatPrice(Math.abs(t.amount), t.currency)}
              </span>
            ),
          },
          { header: "Before → after", className: "whitespace-nowrap text-right tabular-nums text-fg-muted", cell: (t) => `${formatPrice(t.balanceBefore, t.currency)} → ${formatPrice(t.balanceAfter, t.currency)}` },
          {
            header: "Source",
            cell: (t) =>
              t.source.kind === "order" ? (
                <Link href={`/admin/orders/${t.source.id}`} className="text-primary hover:underline">Order</Link>
              ) : t.source.kind === "payment" ? (
                <Link href={`/admin/topups/${t.source.id}`} className="text-primary hover:underline">Top-up</Link>
              ) : t.source.kind === "admin" ? (
                <Link href={`/admin/users/${t.source.id}`} className="text-primary hover:underline">Admin</Link>
              ) : (
                <span className="text-fg-muted">System</span>
              ),
          },
          { header: "Reference", desktopOnly: true, cell: (t) => <span className="block max-w-56 truncate font-mono text-xs text-fg-subtle" title={t.description ?? undefined}>{t.reference}</span> },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/transactions", sp)} />
    </Card>
  );
}
