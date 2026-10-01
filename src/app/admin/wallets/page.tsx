import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam, Stat, UserStatusBadge } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { getDashboard, listWallets } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Wallets" };

/** Every customer wallet. Balances change only through ledger entries; adjust from the customer's page. */
export default async function AdminWalletsPage({ searchParams }: PageProps<"/admin/wallets">) {
  await requireAdminPage("/admin/wallets");
  const sp = await searchParams;
  const q = one(sp.q);
  const nonZero = one(sp.balance) === "nonzero";
  const sort = (["balance_desc", "balance_asc", "updated"] as const).find((s) => s === one(sp.sort)) ?? "balance_desc";
  const [d, wallets] = await Promise.all([getDashboard(), listWallets({ q, nonZero, sort, page: pageParam(sp.page) })]);
  const money = (v: number) => formatPrice(v, d.currency);

  return (
    <>
      <Card>
        <PageHeader
          title="Wallets"
          description="Customer balances. Every change is a ledger entry; manual credits and deductions are made on the customer's page and audited."
          actions={
            <ButtonLink href="/admin/transactions" size="sm" variant="outline">
              Ledger
            </ButtonLink>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat icon="wallet" label="All balances" value={money(d.money.walletBalances)} />
          <Stat icon="plus" label="Deposits (all time)" value={money(d.money.deposits)} />
          <Stat icon="chart" label="Purchases" value={money(d.money.purchases)} />
          <Stat icon="refresh" label="Refunds" value={money(d.money.refunds)} />
          <Stat icon="settings" label="Adjustments" value={money(d.money.adjustments)} />
        </div>
      </Card>
      <Card>
        <AdminFilters
          action="/admin/wallets"
          active={Boolean(q || nonZero || sort !== "balance_desc")}
          fields={[
            { kind: "search", name: "q", placeholder: "Customer name or email", value: q },
            { kind: "select", name: "balance", label: "Balance", value: nonZero ? "nonzero" : "", options: [{ value: "", label: "All wallets" }, { value: "nonzero", label: "With balance" }] },
            {
              kind: "select",
              name: "sort",
              label: "Sort",
              value: sort,
              options: [
                { value: "balance_desc", label: "Highest balance" },
                { value: "balance_asc", label: "Lowest balance" },
                { value: "updated", label: "Recently changed" },
              ],
            },
          ]}
        />
        <p className="mb-3 text-sm text-fg-muted">
          {wallets.total.toLocaleString("en-US")} wallets · {money(wallets.sum)} in total
        </p>
        <AdminTable
          rows={wallets.items}
          rowKey={(w) => w.id}
          empty={<EmptyState compact icon="wallet" title="No wallets match" />}
          columns={[
            {
              header: "Customer",
              cell: (w) => (
                <Link href={`/admin/users/${w.user.id}`} className="block min-w-0 hover:text-primary">
                  <span className="block truncate font-medium">{w.user.name}</span>
                  <span className="block truncate text-xs text-fg-muted">{w.user.email}</span>
                </Link>
              ),
            },
            { header: "Status", cell: (w) => <UserStatusBadge status={w.user.status} /> },
            { header: "Balance", className: "text-end font-semibold tabular-nums", cell: (w) => formatPrice(w.balance, w.currency) },
            { header: "Last change", className: "whitespace-nowrap text-fg-muted", cell: (w) => formatShortDateTime(w.updatedAt) },
            {
              header: "Actions",
              cell: (w) => (
                <span className="inline-flex gap-3 text-sm">
                  <Link href={`/admin/users/${w.user.id}#wallet`} className="text-primary hover:underline">
                    Adjust
                  </Link>
                  <Link href={`/admin/transactions?userId=${w.user.id}`} className="text-primary hover:underline">
                    History
                  </Link>
                </span>
              ),
            },
          ]}
        />
        <Pagination page={wallets.page} pageSize={wallets.pageSize} total={wallets.total} hrefFor={pageHref("/admin/wallets", sp)} />
      </Card>
    </>
  );
}
