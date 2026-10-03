import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
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
import { requireUser } from "@/server/auth/session";
import { getOrderStats } from "@/server/services/account.service";
import { getT } from "@/i18n/server";
import { dateRangeLabel } from "@/i18n/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("stats.title") };
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/** Every figure is computed from stored orders, SMS and ledger rows — nothing is estimated. */
export default async function StatisticsPage({ searchParams }: PageProps<"/profile/statistics">) {
  const user = await requireUser("/profile/statistics");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 20) : undefined);
  const range = resolveDateRange({
    range: one(sp.range),
    from: one(sp.from),
    to: one(sp.to),
  });
  const [stats, t] = await Promise.all([getOrderStats(user.id, range), getT()]);
  const rangeLabel = dateRangeLabel(range, t);
  const money = (v: number) => <Money amount={v} currency={stats.currency} variant="stack" />;
  const empty = stats.total === 0 && stats.deposits === 0 && stats.payments.paid + stats.payments.pending + stats.payments.unpaid === 0;
  // The chart shows at most 62 days; longer ranges show their last 62.
  const chartStart = Date.parse(`${stats.byDay[0].date}T00:00:00Z`);
  const chartTitle = range.preset === "all" ? t("stats.last14") : range.from && range.from.getTime() < chartStart ? t("stats.last62") : rangeLabel;

  return (
    <>
      <Card>
        <PageHeader title={t("stats.title")} description={t("stats.intro", { range: rangeLabel })} />
        <DateRangeFilter range={range} basePath="/profile/statistics" className="mb-5" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          <StatCard
            icon="phone"
            label={t("stats.ordered")}
            value={String(stats.total)}
            hint={stats.active ? t("stats.activeNow", { count: stats.active }) : undefined}
          />
          <StatCard
            icon="checkCircle"
            label={t("stats.completed")}
            value={String(stats.completed)}
            hint={
              stats.total
                ? t("stats.successRate", {
                    pct: pct(stats.completed, stats.total),
                  })
                : undefined
            }
          />
          <StatCard icon="close" label={t("stats.cancelled")} value={String(stats.cancelled)} hint={t("stats.refunded")} />
          <StatCard icon="message" label={t("stats.sms")} value={String(stats.smsReceived)} />
          <StatCard icon="chart" label={t("stats.spent")} value={money(stats.spent)} hint={t("stats.spentHint")} />
          <StatCard icon="plus" label={t("stats.deposits")} value={money(stats.deposits)} />
          <StatCard
            icon="checkCircle"
            label={t("stats.payments")}
            value={String(stats.payments.paid)}
            hint={
              stats.payments.paid
                ? (() => {
                    // "{amount} added", with the amount shown in the visitor's currency too.
                    const [before, after] = t("stats.added", { amount: "\u0000" }).split("\u0000");
                    return (
                      <>
                        {before}
                        <Money amount={stats.payments.paidAmount} currency={stats.currency} variant="both" />
                        {after}
                      </>
                    );
                  })()
                : stats.payments.pending
                  ? t("stats.awaiting", { count: stats.payments.pending })
                  : undefined
            }
          />
          <StatCard icon="wallet" label={t("stats.balance")} value={money(stats.balance)} />
        </div>
      </Card>

      {empty ? (
        <Card>
          <EmptyState
            icon="chart"
            title={range.preset === "all" ? t("stats.noActivity") : t("stats.noActivityPeriod")}
            description={range.preset === "all" ? t("stats.noActivityHint") : t("stats.longerRange")}
            action={
              range.preset === "all" ? (
                <ButtonLink href="/price">{t("purchase.title")}</ButtonLink>
              ) : (
                <ButtonLink href="/profile/statistics" variant="outline">
                  {t("stats.showAll")}
                </ButtonLink>
              )
            }
          />
        </Card>
      ) : stats.total === 0 ? null : (
        <>
          <Card>
            <PageHeader as="h2" title={chartTitle} className="mb-3" />
            <ActivityChart days={stats.byDay} />
          </Card>

          <Card>
            <PageHeader as="h2" title={t("stats.byService")} className="mb-3" />
            <Table>
              <THead>
                <tr>
                  <Th>{t("common.service")}</Th>
                  <Th className="pe-6 text-end">{t("stats.orders")}</Th>
                  <Th className="hidden sm:table-cell">{t("stats.rate")}</Th>
                  <Th className="text-end">{t("stats.spentCol")}</Th>
                </tr>
              </THead>
              <TBody>
                {stats.byService.map((s) => {
                  const rate = pct(s.completed, s.total);
                  return (
                    <Tr key={s.name}>
                      <Td>
                        <span className="flex items-center gap-2 font-medium">
                          <ServiceAvatar name={s.name} color={s.color} logo={s.logo} size={22} />
                          <span className="max-w-44 truncate">{s.name}</span>
                        </span>
                      </Td>
                      <Td className="pe-6 text-end tabular-nums">{s.total}</Td>
                      <Td className="hidden sm:table-cell">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                          </span>
                          <span className="text-sm tabular-nums">{rate}%</span>
                        </span>
                      </Td>
                      <Td className="pe-0 text-end tabular-nums">{money(s.spent)}</Td>
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
