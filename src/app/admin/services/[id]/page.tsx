import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyValues, pageHref, pageParam, YesNo } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { CountryFlag } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { requireAdminPage } from "@/server/admin/guard";
import { getAdminService } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Service" };

export default async function AdminServicePage({ params, searchParams }: PageProps<"/admin/services/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/services/${id}`);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const sp = await searchParams;
  const data = await getAdminService(n, pageParam(sp.page));
  if (!data) notFound();
  const { service, prices } = data;

  return (
    <Card>
      <Breadcrumbs items={[{ label: "Services", href: "/admin/services" }, { label: service.name }]} className="mb-3" />
      <PageHeader title={service.name} description="Per-country prices from the last sync. Customer price = provider cost + your markup (see Pricing)." />
      <KeyValues
        rows={[
          ["Slug / provider code", <span key="c" className="font-mono text-xs">{service.slug} · {service.providerCode}</span>],
          ["Listed by provider", <YesNo key="p" value={service.providerActive} />],
          ["Enabled locally", <YesNo key="l" value={service.isActive} />],
          ["Featured", <YesNo key="f" value={service.isPopular} />],
        ]}
      />
      <div className="mt-5">
        <AdminTable
          rows={prices.items}
          rowKey={(p) => String(p.id)}
          empty={<EmptyState compact icon="globe" title="No prices" />}
          columns={[
            { header: "Country", cell: (p) => <span className="inline-flex items-center gap-2"><CountryFlag iso2={p.country.iso2} />{p.country.name}{!p.country.isActive && <Badge tone="neutral">Disabled</Badge>}</span> },
            { header: "Provider cost", className: "text-end tabular-nums text-fg-muted", cell: (p) => formatPrice(p.providerCost, p.providerCurrency) },
            { header: "Customer price", className: "text-end tabular-nums font-medium", cell: (p) => formatPrice(p.price, p.currency) },
            { header: "Stock", className: "text-end tabular-nums", cell: (p) => p.available.toLocaleString("en-US") },
            { header: "Synced", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (p) => formatShortDateTime(p.syncedAt) },
          ]}
        />
        <Pagination page={prices.page} pageSize={prices.pageSize} total={prices.total} hrefFor={pageHref(`/admin/services/${service.id}`, sp)} />
      </div>
    </Card>
  );
}
