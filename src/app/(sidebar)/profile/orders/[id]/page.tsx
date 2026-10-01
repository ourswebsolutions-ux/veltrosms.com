import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import { notFound } from "next/navigation";
import { NumberCard } from "@/components/orders/NumberCard";
import { ORDER_STATUS, OrderStatus } from "@/components/orders/OrderStatus";
import { TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPhone } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOrderDetail } from "@/server/services/order.service";
import { ACTIVE_ORDER_STATUSES } from "@/types/account";

export const metadata: Metadata = { title: "Order details" };

/** One of the signed-in user's orders. Anyone else's id is a plain 404. */
export default async function OrderPage({ params }: PageProps<"/profile/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/profile/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const detail = await getOrderDetail(user.id, id);
  if (!detail) notFound();
  const { order, ledger } = detail;
  const live = ACTIVE_ORDER_STATUSES.includes(order.status);

  const rows: [string, React.ReactNode][] = [
    [
      "Order ID",
      <span key="id" className="inline-flex items-center gap-1 font-mono text-sm break-all">
        {order.id}
        <CopyButton value={order.id} label="Copy order ID" className="size-6 shrink-0" />
      </span>,
    ],
    [
      "Service",
      <span key="svc" className="inline-flex items-center gap-2">
        <ServiceAvatar name={order.service.name} color={order.service.color} logo={order.service.logo} size={20} />
        {order.service.name}
      </span>,
    ],
    [
      "Country",
      <span key="cty" className="inline-flex items-center gap-2">
        <CountryFlag iso2={order.country.iso2} />
        {order.country.name}
      </span>,
    ],
    [
      "Number",
      order.phoneNumber ? (
        <span key="num" className="inline-flex items-center gap-1 font-mono">
          {formatPhone(order.phoneNumber)}
          <CopyButton value={order.phoneNumber} label="Copy number" className="size-6" />
        </span>
      ) : (
        "Not assigned"
      ),
    ],
    ["Price", <Money key="price" amount={order.price} currency={order.currency} variant="both" className="font-medium tabular-nums" />],
    ["Status", <OrderStatus key="status" status={order.status} />],
    ["Created", formatDateTime(order.createdAt)],
  ];
  if (order.completedAt) rows.push([order.status === "completed" ? "Completed" : "Closed", formatDateTime(order.completedAt)]);
  if (live && order.expiresAt) rows.push(["Expires", formatDateTime(order.expiresAt)]);

  return (
    <>
      <Card>
        <Breadcrumbs items={[{ label: "Orders", href: "/profile/history?tab=orders" }, { label: `#${order.id.slice(0, 8)}` }]} className="mb-3" />
        <PageHeader
          title={`${order.service.name} · ${order.country.name}`}
          description={ORDER_STATUS[order.status].description}
          actions={
            <ButtonLink href="/price" size="sm" variant="outline">
              Get another number
            </ButtonLink>
          }
        />
        {live && <NumberCard order={order} className="mb-5" />}
        <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-surface-muted p-4 text-[15px] sm:grid-cols-[160px_minmax(0,1fr)]">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-fg-muted">{label}</dt>
              <dd className="-mt-2 min-w-0 sm:mt-0">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <PageHeader as="h2" title="SMS messages" description="Messages received on this number for this order." />
        {order.messages.length === 0 ? (
          <EmptyState
            compact
            icon="message"
            title="No SMS received"
            description={live ? "Messages appear here as soon as they arrive." : "No message arrived for this activation."}
          />
        ) : (
          <ol className="space-y-2">
            {order.messages.map((m) => (
              <li key={m.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                  <span className="font-medium text-fg">{m.sender ?? order.service.name}</span>
                  <time dateTime={m.receivedAt}>{formatDateTime(m.receivedAt)}</time>
                  {m.code && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-success-tint px-2 py-0.5 font-mono text-[15px] font-bold text-success">
                      {m.code}
                      <CopyButton value={m.code} label="Copy code" className="size-6" />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[15px] break-words">{m.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <PageHeader as="h2" title="Payments for this order" description="Charges and refunds from your balance." />
        {ledger.length === 0 ? (
          <EmptyState compact icon="wallet" title="No balance movements" description="Nothing was charged for this order." />
        ) : (
          <ul className="divide-y divide-line">
            {ledger.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium">{TRANSACTION_LABEL[t.type]}</p>
                  <p className="text-[13px] text-fg-muted">{formatDateTime(t.createdAt)}</p>
                </div>
                <span className={cn("font-medium tabular-nums", t.amount >= 0 ? "text-success" : "text-fg")}>
                  <Money amount={t.amount} currency={order.currency} signed variant="stack" className="items-end" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
