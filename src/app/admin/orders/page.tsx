import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { resolveDateRange } from "@/lib/date-range";
import { formatPhone, formatPrice, formatShortDateTime } from "@/lib/format";
import { db } from "@/server/db";
import { requireAdminPage } from "@/server/admin/guard";
import { listAdminOrders } from "@/server/admin/orders";

export const metadata: Metadata = { title: "Orders" };

const STATUSES = ["pending", "active", "sms_received", "completed", "cancelled", "refunded", "failed", "expired"];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdminPage("/admin/orders");
  const sp = await searchParams;
  const q = one(sp.q);
  const status = STATUSES.find((s) => s === one(sp.status));
  const serviceId = Number(one(sp.serviceId)) || undefined;
  const countryId = Number(one(sp.countryId)) || undefined;
  const userId = /^[0-9a-f-]{36}$/.test(one(sp.userId) ?? "") ? one(sp.userId) : undefined;
  const provider = /^[a-z0-9_-]{1,32}$/.test(one(sp.provider) ?? "") ? one(sp.provider) : undefined;
  const range = resolveDateRange({ from: one(sp.from, 10), to: one(sp.to, 10) });
  const [data, services, countries] = await Promise.all([
    listAdminOrders({ q, status, serviceId, countryId, userId, provider, from: range.from, to: range.to, page: pageParam(sp.page) }),
    // Only services/countries that have orders keep the filter lists short.
    db().service.findMany({ where: { orders: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
    db().country.findMany({ where: { orders: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }),
  ]);
  const providers = (await db().order.groupBy({ by: ["provider"] })).map((p) => p.provider);

  return (
    <Card>
      <PageHeader title="Orders" description={`${data.total.toLocaleString("en-US")} matching orders`} />
      <AdminFilters
        action="/admin/orders"
        active={Boolean(q || status || serviceId || countryId || userId || provider || range.preset !== "all")}
        fields={[
          ...(userId ? [{ kind: "hidden" as const, name: "userId", value: userId }] : []),
          { kind: "search", name: "q", placeholder: "Order ID, user email, number or provider ID", value: q },
          { kind: "select", name: "status", label: "Status", value: status, options: [{ value: "", label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))] },
          { kind: "select", name: "serviceId", label: "Service", value: serviceId ? String(serviceId) : "", options: [{ value: "", label: "Any service" }, ...services.map((s) => ({ value: String(s.id), label: s.name }))] },
          { kind: "select", name: "countryId", label: "Country", value: countryId ? String(countryId) : "", options: [{ value: "", label: "Any country" }, ...countries.map((c) => ({ value: String(c.id), label: c.name }))] },
          { kind: "select", name: "provider", label: "Provider", value: provider, options: [{ value: "", label: "Any provider" }, ...providers.map((p) => ({ value: p, label: p }))] },
          { kind: "date", name: "from", label: "From", value: range.fromStr },
          { kind: "date", name: "to", label: "To", value: range.toStr },
        ]}
      />
      {userId && <Alert className="mb-3">Showing one user&apos;s orders.</Alert>}
      {range.error && <Alert tone="warning" className="mb-3">{range.error}</Alert>}
      <AdminTable
        rows={data.items}
        rowKey={(o) => o.id}
        empty={<EmptyState compact icon="search" title="No orders match" />}
        columns={[
          { header: "Order", cell: (o) => <Link href={`/admin/orders/${o.id}`} className="font-mono text-primary hover:underline">#{o.id.slice(0, 8)}</Link> },
          { header: "User", cell: (o) => <Link href={`/admin/users/${o.user.id}`} className="block max-w-48 truncate hover:text-primary">{o.user.email}</Link> },
          { header: "Service", cell: (o) => <span className="block max-w-56 truncate">{o.service.name} · {o.country.name}</span> },
          { header: "Number", className: "font-mono text-xs whitespace-nowrap", desktopOnly: true, cell: (o) => (o.phoneNumber ? formatPhone(o.phoneNumber) : "—") },
          { header: "Status", cell: (o) => <OrderStatus status={o.status} /> },
          { header: "SMS", className: "text-right tabular-nums", desktopOnly: true, cell: (o) => o.smsCount },
          { header: "Amount", className: "text-right tabular-nums", cell: (o) => formatPrice(o.price, o.currency) },
          { header: "Created", className: "whitespace-nowrap text-fg-muted", cell: (o) => formatShortDateTime(o.createdAt) },
          { header: "Closed", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (o) => (o.completedAt ? formatShortDateTime(o.completedAt) : "—") },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/orders", sp)} />
    </Card>
  );
}
