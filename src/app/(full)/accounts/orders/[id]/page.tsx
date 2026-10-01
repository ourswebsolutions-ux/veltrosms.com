import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Money } from "@/components/currency/DisplayCurrency";
import { MarkCompletedButton } from "@/components/ready-made/MarkCompletedButton";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatDateTime } from "@/lib/format";
import { readyMadeWhatsappHref } from "@/lib/whatsapp";
import { requireUser } from "@/server/auth/session";
import { getReadyMadeOrder, readyMadeContact } from "@/server/services/ready-made.service";

export const metadata: Metadata = { title: "Ready Made order", robots: { index: false } };

/**
 * Result page of a Ready Made purchase: the reference and how to receive it on
 * WhatsApp. Only the buyer can open it; anyone else's id is a plain 404. No
 * number or code is shown here — delivery is manual.
 */
export default async function ReadyMadeOrderPage({ params, searchParams }: PageProps<"/accounts/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/accounts/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [order, contact, sp] = await Promise.all([getReadyMadeOrder(user.id, id), readyMadeContact(), searchParams]);
  if (!order) notFound();
  const completed = order.status === "completed";
  const justBought = sp.purchased === "1" && !completed;
  const wa = readyMadeWhatsappHref(contact.whatsappDigits, {
    reference: order.reference,
    service: order.service.name,
    country: order.country?.name ?? null,
    email: user.email,
  });

  return (
    <PageContainer size="form" className="max-w-[720px] space-y-4">
      <Card className="sm:!p-8">
        <Breadcrumbs items={[{ label: "Ready Made Accounts", href: "/accounts" }, { label: order.reference }]} className="mb-3" />
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success" aria-hidden="true">
            <Icon name="checkCircle" size={34} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-[28px]">
              {completed ? "Ready Made order completed" : justBought ? "Ready Made Account Purchased" : "Ready Made order"}
            </h1>
            <p className="mt-1 text-[15px] text-fg-muted">
              {completed ? "You confirmed that you received your number/account." : "Your order has been successfully placed."}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#25d366]/40 bg-[#25d366]/10 p-5 text-center">
          <p className="text-[17px] font-semibold">
            {completed ? "Need help with this order? Contact us on WhatsApp." : "To receive your purchased number/account, contact us on WhatsApp."}
          </p>
          <p className="mt-1 text-sm text-fg-muted">Send us your order reference — it is already included in the message.</p>
          <p className="mt-4 text-sm text-fg-muted">WhatsApp</p>
          <p className="text-2xl font-bold tracking-wide tabular-nums">
            <span dir="ltr">{contact.whatsapp}</span>
          </p>
          <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" size="lg" className="mt-4 !bg-[#25d366] hover:!bg-[#1ebe5a]">
            <Icon name="message" size={20} /> Contact on WhatsApp
          </ButtonLink>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl bg-surface-muted p-4 text-[15px] sm:grid-cols-[160px_minmax(0,1fr)]">
          <dt className="text-fg-muted">Order reference</dt>
          <dd className="-mt-2 inline-flex items-center gap-1 font-mono font-semibold sm:mt-0">
            {order.reference}
            <CopyButton value={order.reference} label="Copy order reference" className="size-6" />
          </dd>
          <dt className="text-fg-muted">Service</dt>
          <dd className="-mt-2 inline-flex items-center gap-2 sm:mt-0">
            <ServiceAvatar name={order.service.name} color={order.service.color} logo={order.service.logo} size={20} />
            {order.service.name}
          </dd>
          <dt className="text-fg-muted">Country</dt>
          <dd className="-mt-2 inline-flex items-center gap-2 sm:mt-0">
            {order.country ? (
              <>
                <CountryFlag iso2={order.country.iso2} />
                {order.country.name}
              </>
            ) : (
              "All countries"
            )}
          </dd>
          <dt className="text-fg-muted">Purchase type</dt>
          <dd className="-mt-2 sm:mt-0">Ready Made account</dd>
          <dt className="text-fg-muted">Price paid</dt>
          <dd className="-mt-2 sm:mt-0">
            <Money amount={order.price} currency={order.currency} variant="both" className="font-medium tabular-nums" />
          </dd>
          <dt className="text-fg-muted">Status</dt>
          <dd className="-mt-2 sm:mt-0">
            {completed ? <Badge tone="success">Completed</Badge> : <Badge tone="soft">Awaiting delivery</Badge>}
          </dd>
          <dt className="text-fg-muted">Purchased</dt>
          <dd className="-mt-2 sm:mt-0">{formatDateTime(order.createdAt)}</dd>
          {order.completedAt && (
            <>
              <dt className="text-fg-muted">Completed</dt>
              <dd className="-mt-2 sm:mt-0">{formatDateTime(order.completedAt)}</dd>
            </>
          )}
        </dl>

        {completed ? (
          <Alert tone="success" className="mt-4">
            This order is completed.
          </Alert>
        ) : (
          <div className="mt-4 space-y-3 rounded-xl border border-line p-4">
            <p className="text-[15px]">
              Your number/account and any code are provided by our team on WhatsApp. Nothing is sent to this page automatically. Once you have
              received it, mark the order as completed.
            </p>
            <MarkCompletedButton orderId={order.id} reference={order.reference} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/accounts" variant="outline">
            Back to Ready Made Accounts
          </ButtonLink>
          <ButtonLink href="/profile/history" variant="muted">
            Balance history
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
