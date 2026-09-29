import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/AdminForms";
import { KeyValues } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime, formatPhone, formatPrice, formatShortDateTime } from "@/lib/format";
import { adminCancelOrderAction, adminRefreshOrderAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { getAdminOrder } from "@/server/admin/orders";
import { ACTIVE_ORDER_STATUSES } from "@/types/account";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/orders/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getAdminOrder(id);
  if (!data) notFound();
  const { order, detail, requests } = data;
  const o = detail.order;
  const live = ACTIVE_ORDER_STATUSES.includes(o.status);

  return (
    <>
      <Card>
        <Breadcrumbs items={[{ label: "Orders", href: "/admin/orders" }, { label: `#${o.id.slice(0, 8)}` }]} className="mb-3" />
        <PageHeader title={`${o.service.name} · ${o.country.name}`} actions={<OrderStatus status={o.status} />} />
        <KeyValues
          rows={[
            ["Order ID", <span key="id" className="font-mono text-xs">{o.id}</span>],
            ["User", <Link key="u" href={`/admin/users/${order.user.id}`} className="text-primary hover:underline">{order.user.email}</Link>],
            ["Number", o.phoneNumber ? <span key="n" className="font-mono">{formatPhone(o.phoneNumber)}</span> : "Not assigned"],
            ["Price", formatPrice(o.price, o.currency)],
            ["Provider cost", data.providerCost !== null ? formatPrice(data.providerCost) : "—"],
            ["Provider activation ID", <span key="p" className="font-mono text-xs">{order.providerActivationId ?? "—"}</span>],
            ["Created", formatDateTime(o.createdAt)],
            ["Closed", o.completedAt ? formatDateTime(o.completedAt) : "—"],
            ["Expires", live && o.expiresAt ? formatDateTime(o.expiresAt) : "—"],
            ["Failure reason", data.failureReason ?? "—"],
          ]}
        />
        <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-line pt-4">
          {live && <ActionButton action={adminRefreshOrderAction} fields={{ orderId: o.id }} label="Refresh provider status" />}
          {o.canCancel && (
            <ActionButton
              action={adminCancelOrderAction}
              fields={{ orderId: o.id }}
              label="Cancel at provider"
              tone="danger"
              confirm={{
                title: "Cancel this order?",
                body: "The number is released at the provider. The customer is refunded once (only if the provider confirms the cancellation).",
                cta: "Cancel order",
              }}
            />
          )}
          {!live && <p className="text-sm text-fg-muted">This order is closed; no provider actions are available.</p>}
        </div>
      </Card>

      <Card>
        <PageHeader as="h2" title="SMS" />
        {o.messages.length === 0 ? (
          <EmptyState compact icon="message" title="No SMS received" />
        ) : (
          <ul className="space-y-2 text-sm">
            {o.messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-line p-3">
                <p className="text-xs text-fg-muted">
                  {m.sender ?? "—"} · {formatDateTime(m.receivedAt)} {m.code && <b className="ml-1 font-mono text-success">{m.code}</b>}
                </p>
                <p className="mt-1 break-words">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <PageHeader as="h2" title="Ledger" description="Charge and refund entries for this order." />
        <AdminTable
          rows={detail.ledger}
          rowKey={(t) => t.id}
          empty={<EmptyState compact icon="wallet" title="No ledger entries" />}
          columns={[
            { header: "Type", cell: (t) => TRANSACTION_LABEL[t.type] },
            { header: "Amount", className: "text-right tabular-nums", cell: (t) => `${t.amount >= 0 ? "+" : "−"}${formatPrice(Math.abs(t.amount), o.currency)}` },
            { header: "Date", className: "whitespace-nowrap text-fg-muted", cell: (t) => formatShortDateTime(t.createdAt) },
          ]}
        />
      </Card>

      <Card>
        <PageHeader as="h2" title="Provider requests" description="Calls made for this order (outcome only; no credentials or raw payloads)." />
        <AdminTable
          rows={requests}
          rowKey={(r) => r.id}
          empty={<EmptyState compact icon="cpu" title="No provider calls recorded" />}
          columns={[
            { header: "Action", className: "font-mono text-xs", cell: (r) => r.action },
            { header: "Result", cell: (r) => (r.success ? <Badge tone="success">OK</Badge> : <Badge tone="danger">{r.errorCategory ?? "Error"}</Badge>) },
            { header: "Code", className: "font-mono text-xs", cell: (r) => r.errorCode ?? (r.httpStatus ? `HTTP ${r.httpStatus}` : "—") },
            { header: "Time", className: "text-right tabular-nums", cell: (r) => `${r.durationMs} ms` },
            { header: "At", className: "whitespace-nowrap text-fg-muted", cell: (r) => formatShortDateTime(r.createdAt) },
          ]}
        />
      </Card>
    </>
  );
}
