import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { ManualPaymentHelp, ManualTopUpForm, PaymentAccount } from "@/components/payments/ManualPayment";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatus";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { TopUpForm } from "@/components/payments/TopUpForm";
import { TransactionsTable } from "@/components/profile/TransactionsTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { whatsappHref } from "@/lib/whatsapp";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile, listTransactions } from "@/server/services/account.service";
import { getTopUpOptions, listOpenTopUps, listTopUps } from "@/server/services/payment.service";
import { getT } from "@/i18n/server";
import { DateTime } from "@/components/ui/DateTime";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.addFunds") };
}

export default async function TopUpPage() {
  const user = await requireUser("/profile/top-up");
  const [profile, open, recent, activity, options] = await Promise.all([
    getAccountProfile(user),
    listOpenTopUps(user.id),
    listTopUps(user.id, { pageSize: 5 }),
    listTransactions(user.id, { pageSize: 5 }),
    getTopUpOptions(),
  ]);
  const manual = options.flow === "manual" ? options.manual : null;
  const t = await getT();
  const wa = manual ? whatsappHref(manual, { email: profile.email }, t) : null;

  return (
    <>
      <Card>
        <PageHeader
          title={t("nav.addFunds")}
          description={manual ? t("topup.introManual") : t("topup.intro")}
          actions={
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-sm text-fg-muted">
                {t("common.balance")}{" "}
              <b className="text-base text-fg tabular-nums">
                <Money amount={profile.balance} currency={profile.currency} variant="both" />
              </b>
              </span>
              {manual && <ManualPaymentHelp details={manual} email={profile.email} />}
            </span>
          }
        />
        {!options.available ? (
          <EmptyState
            icon="wallet"
            title={t("topup.unavailable")}
            description={t("topup.unavailableHint")}
            action={<ButtonLink href="/price" variant="outline">{t("topup.browseNumbers")}</ButtonLink>}
          />
        ) : manual ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section aria-labelledby="manual-payment" className="space-y-4">
              <div>
                <h2 id="manual-payment" className="text-[15px] font-semibold">
                  {t("topup.step1")}
                </h2>
                <p className="mt-1 text-sm text-fg-muted">{t("topup.step1Hint")}</p>
              </div>
              <PaymentAccount details={manual} />
              <ul className="space-y-1.5 text-sm text-fg-muted">
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> {t("topup.keepTid")}
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> {t("topup.sameAmount")}
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> {t("topup.addedAfter")}
                </li>
              </ul>
              {wa && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                  <span className="min-w-48 flex-1 text-sm">
                    {t("topup.needHelp")}{" "}
                    <b className="whitespace-nowrap" dir="ltr">
                      {manual.whatsapp}
                    </b>
                  </span>
                  <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" size="sm" className="!bg-[#25d366] hover:!bg-[#1ebe5a]">
                    <Icon name="message" size={16} /> {t("wa.contact")}
                  </ButtonLink>
                </div>
              )}
              {manual.note && <p className="text-sm text-fg-muted">{manual.note}</p>}
            </section>
            <section aria-labelledby="manual-request">
              <h2 id="manual-request" className="mb-3 text-[15px] font-semibold">
                {t("topup.step2")}
              </h2>
              <ManualTopUpForm options={options} balance={profile.balance} />
            </section>
          </div>
        ) : (
          <TopUpForm options={options} balance={profile.balance} />
        )}
      </Card>

      {open.length > 0 && (
        <Card>
          <PageHeader as="h2" title={manual ? t("topup.awaiting") : t("topup.unfinished")} />
          <ul className="space-y-2">
            {open.map((p) => (
              <li key={p.id} className="rounded-xl border border-primary-tint-border p-3 sm:flex sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">
                    <Money amount={p.amount} currency={p.currency} variant="both" /> <span className="font-normal text-fg-muted">· {p.methodLabel}</span>
                  </p>
                  <p className="text-[13px] text-fg-muted">
                    <bdi className="font-mono whitespace-nowrap">{p.transactionId ? `TID ${p.transactionId}` : p.reference}</bdi> ·{" "}
                    <span className="whitespace-nowrap">
                      <DateTime iso={p.createdAt} short />
                    </span>
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 sm:mt-0">
                  <PaymentStatusBadge status={p.status} manual={p.manual} />
                  <span className="ms-auto flex gap-2 sm:ms-0">
                    {p.checkoutUrl && (
                      <ButtonLink href={p.checkoutUrl} size="sm">
                        {t("topup.pay")}
                      </ButtonLink>
                    )}
                    <ButtonLink href={`/profile/top-up/${p.id}`} size="sm" variant="outline">
                      {t("common.details")}
                    </ButtonLink>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <PageHeader
          as="h2"
          title={t("topup.history")}
          actions={
            recent.total > 0 && (
              <ButtonLink href="/profile/history?tab=payments" size="sm" variant="ghost">
                {t("topup.allTopups")} <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {recent.items.length === 0 ? (
          <EmptyState compact icon="wallet" title={t("topup.noTopups")} description={t("topup.noTopupsHint")} />
        ) : (
          <PaymentsTable payments={recent.items} />
        )}
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title={t("topup.recentActivity")}
          actions={
            activity.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                {t("nav.balanceHistory")} <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {activity.items.length === 0 ? (
          <EmptyState compact icon="history" title={t("stats.noActivity")} description={t("topup.noActivityHint")} />
        ) : (
          <TransactionsTable transactions={activity.items} />
        )}
      </Card>
    </>
  );
}
