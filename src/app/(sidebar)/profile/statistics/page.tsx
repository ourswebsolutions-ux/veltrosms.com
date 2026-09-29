import type { Metadata } from "next";
import { ActivityChart } from "@/components/profile/ActivityChart";
import { DateRangeFilter } from "@/components/profile/DateRangeFilter";
import { StatCard } from "@/components/profile/ProfileParts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { resolveDateRange } from "@/lib/date-range";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOrderStats } from "@/server/services/account.service";

export const metadata: Metadata = { title: "Query statistics" };

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/** Every figure is computed from stored orders, SMS and ledger rows — nothing is estimated. */
export default async function StatisticsPage({ searchParams }: PageProps<"/profile/statistics">) {
  const user = await requireUser("/profile/statistics");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 20) : undefined);
  const range = resolveDateRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) });
  const stats = await getOrderStats(user.id, range);
  const money = (v: number) => formatPrice(v, stats.currency);
  const empty = stats.total === 0 && stats.deposits === 0 && stats.payments.paid + stats.payments.pending + stats.payments.unpaid === 0;
  // The chart shows at most 62 days; longer ranges show their last 62.
  const chartStart = Date.parse(`${stats.byDay[0].date}T00:00:00Z`);
  const chartTitle =
    range.preset === "all" ? "Last 14 days" : range.from && range.from.getTime() < chartStart ? "Last 62 days of the range" : range.label;

  return (
    <>
      <Card>
        <PageHeader title="Query statistics" description={`Your activations, payments and balance · ${range.label} (days in UTC).`} />
        <DateRangeFilter range={range} basePath="/profile/statistics" className="mb-5" />
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <StatCard icon="phone" label="Numbers ordered" value={String(stats.total)} hint={stats.active ? `${stats.active} active now` : undefined} />
          <StatCard icon="checkCircle" label="Completed" value={String(stats.completed)} hint={stats.total ? `${pct(stats.completed, stats.total)}% success rate` : undefined} />
          <StatCard icon="close" label="Cancelled or expired" value={String(stats.cancelled)} hint="Refunded to your balance" />
          <StatCard icon="message" label="SMS received" value={String(stats.smsReceived)} />
          <StatCard icon="chart" label="Total spent" value={money(stats.spent)} hint="Purchases minus refunds" />
          <StatCard icon="plus" label="Deposits" value={money(stats.deposits)} />
          <StatCard
            icon="checkCircle"
            label="Successful payments"
            value={String(stats.payments.paid)}
            hint={stats.payments.paid ? `${money(stats.payments.paidAmount)} added` : stats.payments.pending ? `${stats.payments.pending} awaiting payment` : undefined}
          />
          <StatCard icon="wallet" label="Current balance" value={money(stats.balance)} />
        </div>
      </Card>

      {empty ? (
        <Card>
          <EmptyState
            icon="chart"
            title={range.preset === "all" ? "No activity yet" : "No activity in this period"}
            description={range.preset === "all" ? "Charts by day and by service appear after your first number." : "Try a longer date range."}
            action={range.preset === "all" ? <ButtonLink href="/price">Get a number</ButtonLink> : <ButtonLink href="/profile/statistics" variant="outline">Show all time</ButtonLink>}
          />
        </Card>
      ) : stats.total === 0 ? null : (
        <>
          <Card>
            <PageHeader as="h2" title={chartTitle} className="mb-3" />
            <ActivityChart days={stats.byDay} />
          </Card>

          <Card>
            <PageHeader as="h2" title="By service" className="mb-3" />
            <Table>
              <THead>
                <tr>
                  <Th>Service</Th>
                  <Th className="pr-6 text-right">Orders</Th>
                  <Th className="hidden sm:table-cell">Success rate</Th>
                  <Th className="text-right">Spent</Th>
                </tr>
              </THead>
              <TBody>
                {stats.byService.map((s) => {
                  const rate = pct(s.completed, s.total);
                  return (
                    <Tr key={s.name}>
                      <Td>
                        <span className="flex items-center gap-2 font-medium">
                          <ServiceAvatar name={s.name} color={s.color} size={22} />
                          <span className="max-w-44 truncate">{s.name}</span>
                        </span>
                      </Td>
                      <Td className="pr-6 text-right tabular-nums">{s.total}</Td>
                      <Td className="hidden sm:table-cell">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                          </span>
                          <span className="text-sm tabular-nums">{rate}%</span>
                        </span>
                      </Td>
                      <Td className="pr-0 text-right tabular-nums">{money(s.spent)}</Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
