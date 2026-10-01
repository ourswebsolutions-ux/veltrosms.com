import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { ActiveOrdersList } from "@/components/orders/ActiveOrdersList";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { OrdersTable } from "@/components/profile/OrdersTable";
import { TransactionsTable } from "@/components/profile/TransactionsTable";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile, listTransactions } from "@/server/services/account.service";
import { listActiveOrders, listOrders } from "@/server/services/order.service";
import { getLocale, getT } from "@/i18n/server";
import { intlLocale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.receivedNumbers") };
}

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const [profile, active, recent, activity] = await Promise.all([
    getAccountProfile(user),
    listActiveOrders(user.id),
    listOrders(user.id, { pageSize: 8 }),
    listTransactions(user.id, { pageSize: 5 }),
  ]);
  const p = profile;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const memberSince = new Date(p.createdAt).toLocaleDateString(intlLocale(locale), { month: "long", year: "numeric" });

  return (
    <>
      <Card>
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xl font-bold text-primary uppercase">
              {p.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold">{p.name}</h1>
                <Badge tone={p.status === "active" ? "success" : "danger"}>{p.status === "active" ? t("profile.active") : t("profile.suspended")}</Badge>
                {!p.emailVerified && <Badge tone="warning">{t("auth.notConfirmed")}</Badge>}
              </div>
              <p className="truncate text-[15px] text-fg-muted">
                <bdi>{p.email}</bdi>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-fg-muted">
                <span>{t("profile.memberSince", { date: memberSince })}</span>
                <span className="inline-flex items-center gap-1">
                  {t("profile.id")} <bdi className="font-mono">{p.id.slice(0, 8)}</bdi>
                  <CopyButton value={p.id} label={t("profile.copyId")} className="size-6" />
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-muted/60 px-4 py-3">
            <div>
              <p className="text-[13px] text-fg-muted">{t("common.balance")}</p>
              <p className="text-2xl font-semibold tabular-nums">
                <Money amount={p.balance} currency={p.currency} variant="stack" approxClassName="text-sm" />
              </p>
            </div>
            <ButtonLink href="/profile/top-up">
              <Icon name="plus" size={18} /> {t("nav.topUp")}
            </ButtonLink>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <ButtonLink href="/price" size="sm">
            {t("purchase.title")}
          </ButtonLink>
          <ButtonLink href="/profile/settings#api-key" size="sm" variant="outline">
            <Icon name="key" size={16} /> {p.apiKeyHint ? t("nav.apiKey") : t("profile.createApiKey")}
          </ButtonLink>
          <ButtonLink href="/profile/settings" size="sm" variant="muted">
            <Icon name="settings" size={16} /> {t("nav.settings")}
          </ButtonLink>
          <LogoutButton className="ms-auto" />
        </div>
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title={t("market.activeNumbers")}
          description={t("profile.activeIntro")}
        />
        <ActiveOrdersList
          orders={active}
          className="xl:grid-cols-2"
          empty={
            <EmptyState
              icon="phone"
              title={t("price.noActive")}
              description={t("profile.noActiveHint")}
              action={<ButtonLink href="/price">{t("purchase.title")}</ButtonLink>}
            />
          }
        />
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title={t("nav.receivedNumbers")}
          description={t("profile.recentIntro")}
          actions={
            recent.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                {t("market.allOrders")} <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {recent.items.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={t("profile.noNumbers")}
            description={t("profile.noNumbersHint")}
            action={<ButtonLink href="/price" variant="outline">{t("profile.browsePrices")}</ButtonLink>}
          />
        ) : (
          <OrdersTable orders={recent.items} />
        )}
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title={t("profile.walletActivity")}
          description={t("profile.walletIntro")}
          actions={
            activity.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                {t("profile.allTransactions")} <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {activity.items.length === 0 ? (
          <EmptyState
            icon="wallet"
            title={t("profile.noWallet")}
            description={t("profile.noWalletHint")}
            action={<ButtonLink href="/profile/top-up">{t("nav.addFunds")}</ButtonLink>}
          />
        ) : (
          <TransactionsTable transactions={activity.items} />
        )}
      </Card>
    </>
  );
}
