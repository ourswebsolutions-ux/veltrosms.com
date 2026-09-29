import type { Metadata } from "next";
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
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile, listTransactions } from "@/server/services/account.service";
import { getTopUpOptions, listOpenTopUps, listTopUps } from "@/server/services/payment.service";

export const metadata: Metadata = { title: "Add funds" };

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
  const wa = manual ? whatsappHref(manual, { email: profile.email }) : null;

  return (
    <>
      <Card>
        <PageHeader
          title="Add funds"
          description={manual ? "Enter the amount you want to add. Payments are verified manually." : "Top up your balance to buy numbers."}
          actions={
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-sm text-fg-muted">
                Balance <b className="text-base text-fg tabular-nums">{formatPrice(profile.balance, profile.currency)}</b>
              </span>
              {manual && <ManualPaymentHelp details={manual} email={profile.email} />}
            </span>
          }
        />
        {!options.available ? (
          <EmptyState
            icon="wallet"
            title="Adding funds isn't available right now"
            description="Please check back soon. Your existing balance can be used for numbers as usual."
            action={<ButtonLink href="/price" variant="outline">Browse numbers</ButtonLink>}
          />
        ) : manual ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section aria-labelledby="manual-payment" className="space-y-4">
              <div>
                <h2 id="manual-payment" className="text-[15px] font-semibold">
                  1. Send the payment · Manual Easypaisa / JazzCash
                </h2>
                <p className="mt-1 text-sm text-fg-muted">Send the amount manually to this account from Easypaisa or JazzCash.</p>
              </div>
              <PaymentAccount details={manual} />
              <ul className="space-y-1.5 text-sm text-fg-muted">
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> Keep the transaction ID (TID) from your receipt.
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> Submit the request with the same amount you sent.
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" /> Your balance is added after an administrator verifies the payment.
                </li>
              </ul>
              {wa && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                  <span className="min-w-0 flex-1 text-sm">
                    Need help? WhatsApp <b className="whitespace-nowrap">{manual.whatsapp}</b>
                  </span>
                  <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" size="sm" className="!bg-[#25d366] hover:!bg-[#1ebe5a]">
                    <Icon name="message" size={16} /> Contact on WhatsApp
                  </ButtonLink>
                </div>
              )}
              {manual.note && <p className="text-sm text-fg-muted">{manual.note}</p>}
            </section>
            <section aria-labelledby="manual-request">
              <h2 id="manual-request" className="mb-3 text-[15px] font-semibold">
                2. Submit your top-up request
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
          <PageHeader as="h2" title={manual ? "Requests awaiting verification" : "Unfinished payments"} />
          <ul className="space-y-2">
            {open.map((p) => (
              <li key={p.id} className="rounded-xl border border-primary-tint-border p-3 sm:flex sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">
                    {formatPrice(p.amount, p.currency)} <span className="font-normal text-fg-muted">· {p.methodLabel}</span>
                  </p>
                  <p className="text-[13px] text-fg-muted">
                    <span className="font-mono whitespace-nowrap">{p.transactionId ? `TID ${p.transactionId}` : p.reference}</span> ·{" "}
                    <span className="whitespace-nowrap">{formatShortDateTime(p.createdAt)}</span>
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 sm:mt-0">
                  <PaymentStatusBadge status={p.status} manual={p.manual} />
                  <span className="ml-auto flex gap-2 sm:ml-0">
                    {p.checkoutUrl && (
                      <ButtonLink href={p.checkoutUrl} size="sm">
                        Pay
                      </ButtonLink>
                    )}
                    <ButtonLink href={`/profile/top-up/${p.id}`} size="sm" variant="outline">
                      Details
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
          title="Top-up history"
          actions={
            recent.total > 0 && (
              <ButtonLink href="/profile/history?tab=payments" size="sm" variant="ghost">
                All top-ups <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {recent.items.length === 0 ? (
          <EmptyState compact icon="wallet" title="No top-ups yet" description="Your top-up requests and their status appear here." />
        ) : (
          <PaymentsTable payments={recent.items} />
        )}
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Recent wallet activity"
          actions={
            activity.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                Balance history <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {activity.items.length === 0 ? (
          <EmptyState compact icon="history" title="No activity yet" description="Top-ups, purchases and refunds appear here." />
        ) : (
          <TransactionsTable transactions={activity.items} />
        )}
      </Card>
    </>
  );
}
