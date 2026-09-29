import type { Metadata } from "next";
import Link from "next/link";
import { one, ProviderStatusBadge, Stat } from "@/components/admin/AdminParts";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatus";
import { ActivityChart } from "@/components/profile/ActivityChart";
import { DateRangeFilter } from "@/components/profile/DateRangeFilter";
import { TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { resolveDateRange } from "@/lib/date-range";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { getDashboard } from "@/server/admin/platform";
import type { OrderStatus as OrderStatusType, PaymentStatus } from "@/types/account";

export const metadata: Metadata = { title: "Dashboard" };

function Recent({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card className="!p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <ButtonLink href={href} size="sm" variant="ghost">
          View all
        </ButtonLink>
      </div>
      {empty ? <EmptyState compact icon="inbox" title="Nothing yet" /> : <ul className="divide-y divide-line text-sm">{children}</ul>}
    </Card>
  );
}

/** Platform overview. Every figure is aggregated from the database; provider status is a live check. */
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  await requireAdminPage("/admin");
  const sp = await searchParams;
  const range = resolveDateRange({ range: one(sp.range, 10) ?? undefined, from: one(sp.from, 10), to: one(sp.to, 10) });
  const d = await getDashboard(range);
  const money = (v: number) => formatPrice(v, d.currency);
  const period = range.preset === "all" ? "all time" : range.label.toLowerCase();

  return (
    <>
      <Card>
        <PageHeader
          title="Dashboard"
          description={`Live figures from the database · activity for ${period} (days in UTC).`}
          actions={
            d.provider && (
              <Link href="/admin/providers" className="flex items-center gap-2 text-sm text-fg-muted">
                SMS provider <ProviderStatusBadge status={d.provider.status} />
              </Link>
            )
          }
        />
        <DateRangeFilter range={range} basePath="/admin" className="mb-5" />

        <h2 className="mb-2 text-sm font-semibold text-fg-muted">Revenue (number sales − refunds)</h2>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="chart" label={`Revenue · ${period}`} value={money(d.revenue.range.sales)} hint={`Gross margin ${money(d.revenue.range.margin)}`} tone="good" />
          <Stat icon="zap" label="Today's revenue" value={money(d.revenue.today.sales)} hint={`Margin ${money(d.revenue.today.margin)}`} />
          <Stat icon="trendingUp" label="This month" value={money(d.revenue.month.sales)} hint={`Margin ${money(d.revenue.month.margin)}`} />
          <Stat icon="cpu" label="Provider balance" value={d.provider?.balance != null ? formatPrice(d.provider.balance) : "—"} hint="Our account at the SMS provider" tone={d.provider?.balance === 0 ? "warn" : undefined} />
        </div>

        <h2 className="mb-2 text-sm font-semibold text-fg-muted">Users</h2>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="user" label="Total users" value={d.users.total.toLocaleString("en-US")} />
          <Stat icon="checkCircle" label="Active" value={d.users.active.toLocaleString("en-US")} hint={`${d.users.active30} with a session in 30 days`} tone="good" />
          <Stat icon="lock" label="Suspended" value={d.users.suspended.toLocaleString("en-US")} tone={d.users.suspended ? "warn" : undefined} />
          <Stat icon="plus" label={`New users · ${range.preset === "all" ? "today" : period}`} value={d.users.newInRange.toLocaleString("en-US")} />
        </div>

        <h2 className="mb-2 text-sm font-semibold text-fg-muted">Wallets and top-ups</h2>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="wallet" label="Total wallet balance" value={money(d.money.walletBalances)} hint="Sum of all customer wallets" />
          <Stat icon="plus" label={`Deposits · ${period}`} value={money(d.money.deposits)} hint={`Adjustments ${money(d.money.adjustments)}`} />
          <Stat icon="history" label="Pending top-ups" value={String(d.topups.pending)} hint="Waiting for verification" tone={d.topups.pending ? "bad" : undefined} />
          <Stat icon="check" label={`Top-ups · ${period}`} value={`${d.topups.approved} / ${d.topups.rejected}`} hint={`Approved (${money(d.topups.approvedAmount)}) / rejected`} />
        </div>

        <h2 className="mb-2 text-sm font-semibold text-fg-muted">Orders · {period}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon="phone" label="Total orders" value={d.orders.total.toLocaleString("en-US")} />
          <Stat icon="checkCircle" label="Successful" value={d.orders.successful.toLocaleString("en-US")} tone="good" />
          <Stat icon="alert" label="Failed" value={d.orders.failed.toLocaleString("en-US")} hint={`${d.orders.cancelled} cancelled or expired (refunded)`} tone={d.orders.failed ? "warn" : undefined} />
          <Stat icon="refresh" label="Pending / live" value={d.orders.pending.toLocaleString("en-US")} />
        </div>
      </Card>

      <Card>
        <PageHeader as="h2" title={range.preset === "all" ? "Orders, last 14 days" : `Orders · ${range.label}`} className="mb-2" />
        <ActivityChart days={d.byDay} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Recent title="Recent top-up requests" href="/admin/topups?status=all" empty={d.recentTopUps.length === 0}>
          {d.recentTopUps.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Link href={`/admin/topups/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                {p.reference}
              </Link>
              <span className="min-w-0 flex-1 truncate text-fg-muted">{p.email}</span>
              <span className="font-medium tabular-nums">{formatPrice(p.amount, p.currency)}</span>
              <PaymentStatusBadge status={p.status as PaymentStatus} manual />
            </li>
          ))}
        </Recent>
        <Recent title="Recent orders" href="/admin/orders" empty={d.recentOrders.length === 0}>
          {d.recentOrders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Link href={`/admin/orders/${o.id}`} className="min-w-0 flex-1 truncate hover:text-primary">
                {o.label}
                <span className="block truncate text-xs text-fg-muted">{o.email}</span>
              </Link>
              <span className="tabular-nums">{formatPrice(o.price, o.currency)}</span>
              <OrderStatus status={o.status as OrderStatusType} />
            </li>
          ))}
        </Recent>
        <Recent title="Recent transactions" href="/admin/transactions" empty={d.recentTransactions.length === 0}>
          {d.recentTransactions.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-28 shrink-0">{TRANSACTION_LABEL[t.type]}</span>
              <Link href={`/admin/users/${t.userId}`} className="min-w-0 flex-1 truncate text-fg-muted hover:text-primary">
                {t.email}
              </Link>
              <span className={cn("font-medium tabular-nums", t.amount >= 0 && "text-success")}>
                {t.amount >= 0 ? "+" : "−"}
                {formatPrice(Math.abs(t.amount), t.currency)}
              </span>
            </li>
          ))}
        </Recent>
        <Recent title="Recent registrations" href="/admin/users" empty={d.recentUsers.length === 0}>
          {d.recentUsers.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 truncate hover:text-primary">
                {u.name} <span className="text-fg-muted">· {u.email}</span>
              </Link>
              <span className="text-xs text-fg-subtle">{formatShortDateTime(u.createdAt)}</span>
            </li>
          ))}
        </Recent>
      </div>

      <Card>
        <PageHeader
          as="h2"
          title="Recent admin actions"
          actions={
            <ButtonLink href="/admin/audit-logs" size="sm" variant="ghost">
              Audit logs
            </ButtonLink>
          }
        />
        {d.recentAudit.length === 0 ? (
          <EmptyState compact icon="history" title="No admin actions yet" />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                <span className={a.success ? "font-medium" : "font-medium text-danger"}>{a.description ?? a.action}</span>
                <span className="text-fg-muted">{a.actorEmail ?? "system"}</span>
                <span className="ml-auto text-xs text-fg-subtle">{formatShortDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
