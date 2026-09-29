import type { Metadata } from "next";
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
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile, listTransactions } from "@/server/services/account.service";
import { listActiveOrders, listOrders } from "@/server/services/order.service";

export const metadata: Metadata = { title: "Received numbers" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const [profile, active, recent, activity] = await Promise.all([
    getAccountProfile(user),
    listActiveOrders(user.id),
    listOrders(user.id, { pageSize: 8 }),
    listTransactions(user.id, { pageSize: 5 }),
  ]);
  const p = profile;
  const memberSince = new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
                <Badge tone={p.status === "active" ? "success" : "danger"}>{p.status === "active" ? "Active" : "Suspended"}</Badge>
                {!p.emailVerified && <Badge tone="warning">Email not confirmed</Badge>}
              </div>
              <p className="truncate text-[15px] text-fg-muted">{p.email}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-fg-muted">
                <span>Member since {memberSince}</span>
                <span className="inline-flex items-center gap-1">
                  ID <span className="font-mono">{p.id.slice(0, 8)}</span>
                  <CopyButton value={p.id} label="Copy user ID" className="size-6" />
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-muted/60 px-4 py-3">
            <div>
              <p className="text-[13px] text-fg-muted">Balance</p>
              <p className="text-2xl font-semibold tabular-nums">{formatPrice(p.balance, p.currency)}</p>
            </div>
            <ButtonLink href="/profile/top-up">
              <Icon name="plus" size={18} /> Top up
            </ButtonLink>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <ButtonLink href="/price" size="sm">
            Get a number
          </ButtonLink>
          <ButtonLink href="/profile/settings#api-key" size="sm" variant="outline">
            <Icon name="key" size={16} /> {p.apiKeyHint ? "API key" : "Create API key"}
          </ButtonLink>
          <ButtonLink href="/profile/settings" size="sm" variant="muted">
            <Icon name="settings" size={16} /> Settings
          </ButtonLink>
          <LogoutButton className="ml-auto" />
        </div>
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Active numbers"
          description="Numbers that are waiting for or have received an SMS."
        />
        <ActiveOrdersList
          orders={active}
          className="xl:grid-cols-2"
          empty={
            <EmptyState
              icon="phone"
              title="No active numbers"
              description="Pick a service and a country to get a number. Incoming codes appear here instantly."
              action={<ButtonLink href="/price">Get a number</ButtonLink>}
            />
          }
        />
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Received numbers"
          description="Your most recent activations."
          actions={
            recent.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                All orders <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {recent.items.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No numbers yet"
            description="Your received numbers and codes will be listed here."
            action={<ButtonLink href="/price" variant="outline">Browse prices</ButtonLink>}
          />
        ) : (
          <OrdersTable orders={recent.items} />
        )}
      </Card>

      <Card>
        <PageHeader
          as="h2"
          title="Wallet activity"
          description="Your latest top-ups, purchases and refunds."
          actions={
            activity.total > 0 && (
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                All transactions <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )
          }
        />
        {activity.items.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No wallet activity yet"
            description="Add funds to your balance to start buying numbers."
            action={<ButtonLink href="/profile/top-up">Add funds</ButtonLink>}
          />
        ) : (
          <TransactionsTable transactions={activity.items} />
        )}
      </Card>
    </>
  );
}
