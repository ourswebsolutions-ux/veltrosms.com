import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ReadyMadeOffers } from "@/components/ready-made/ReadyMadeOffers";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatShortDateTime } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/session";
import { getViewer } from "@/server/services/account.service";
import { listReadyMadeOffers, listReadyMadeOrders } from "@/server/services/ready-made.service";

export const metadata: Metadata = {
  title: "Ready Made Accounts",
  description: "Ready made accounts for popular services, paid from your balance and delivered by our team on WhatsApp.",
};

/**
 * Ready Made Accounts: admin-configured offers bought from the wallet and
 * delivered manually on WhatsApp. Separate from the virtual-number purchase.
 */
export default async function ReadyMadeAccountsPage() {
  const user = await getCurrentUser();
  const [offers, viewer, purchases] = await Promise.all([listReadyMadeOffers(), getViewer(), user ? listReadyMadeOrders(user.id, 5) : []]);

  return (
    <PageContainer size="form" className="max-w-[900px] space-y-4">
      <Card className="sm:!p-8">
        <PageHeader
          title="Ready Made Accounts"
          description="Choose a service, pay from your balance, then contact us on WhatsApp with your order reference to receive your number/account."
          actions={
            viewer.signedIn ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted py-1 pr-1 pl-3">
                <span className="text-sm text-fg-muted">Balance</span>
                <span className="font-semibold tabular-nums">
                  <Money amount={viewer.balance} currency={viewer.currency} variant="both" />
                </span>
                <ButtonLink href="/profile/top-up" size="sm" variant="soft">
                  <Icon name="plus" size={16} /> Top up
                </ButtonLink>
              </div>
            ) : (
              <ButtonLink href="/login?next=%2Faccounts" size="sm" variant="outline">
                Log in to buy
              </ButtonLink>
            )
          }
        />
        <ReadyMadeOffers offers={offers} viewer={viewer} />
      </Card>

      {purchases.length > 0 && (
        <Card className="sm:!p-8">
          <PageHeader as="h2" title="Your Ready Made purchases" description="Open a purchase to see its reference and contact us on WhatsApp." />
          <ul className="divide-y divide-line">
            {purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/accounts/orders/${p.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                  <ServiceAvatar name={p.service.name} color={p.service.color} logo={p.service.logo} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {p.service.name} · {p.country?.name ?? "All countries"}
                    </span>
                    <span className="block text-[13px] text-fg-muted">
                      <span className="font-mono">{p.reference}</span> · {formatShortDateTime(p.createdAt)}
                    </span>
                  </span>
                  {p.status === "completed" ? <Badge tone="success">Completed</Badge> : <Badge tone="soft">Awaiting delivery</Badge>}
                  <Money amount={p.price} currency={p.currency} variant="stack" className="items-end font-medium tabular-nums" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
