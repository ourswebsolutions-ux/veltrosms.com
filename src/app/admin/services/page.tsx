import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/AdminForms";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { formatPrice } from "@/lib/format";
import { serviceLogo } from "@/lib/service-logos";
import { adminCatalogToggleAction, adminServicePopularAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { serviceColor } from "@/server/catalog/service-hints";
import { listAdminServices } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Services" };

const STATES = ["enabled", "disabled", "provider_off"] as const;

export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  await requireAdminPage("/admin/services");
  const sp = await searchParams;
  const q = one(sp.q);
  const state = STATES.find((s) => s === one(sp.state));
  const data = await listAdminServices({ q, state, page: pageParam(sp.page) });

  return (
    <Card>
      <PageHeader title="Services" description="Imported from the provider. Local switches control what customers see; provider values are read-only." />
      <AdminFilters
        action="/admin/services"
        active={Boolean(q || state)}
        fields={[
          { kind: "search", name: "q", placeholder: "Name or provider code", value: q },
          {
            kind: "select",
            name: "state",
            label: "State",
            value: state,
            options: [{ value: "", label: "All" }, { value: "enabled", label: "On sale" }, { value: "disabled", label: "Disabled locally" }, { value: "provider_off", label: "Off at provider" }],
          },
        ]}
      />
      <AdminTable
        rows={data.items}
        rowKey={(s) => String(s.id)}
        empty={<EmptyState compact icon="grid" title="No services" description="Services appear after a catalog sync." />}
        columns={[
          {
            header: "Service",
            cell: (s) => (
              <Link href={`/admin/services/${s.id}`} className="inline-flex items-center gap-2 font-medium hover:text-primary">
                <ServiceAvatar name={s.name} color={serviceColor(s.providerCode, s.name)} logo={serviceLogo(s.providerCode)} size={22} />
                {s.name}
                {s.isPopular && <Badge tone="warning" className="ms-1.5">Featured</Badge>}
              </Link>
            ),
          },
          { header: "Code", className: "font-mono text-xs", cell: (s) => s.providerCode },
          { header: "Provider", cell: (s) => (s.providerActive ? <Badge tone="success">Listed</Badge> : <Badge tone="neutral">Not listed</Badge>) },
          { header: "Countries in stock", className: "text-end tabular-nums", cell: (s) => s.countriesInStock },
          { header: "From", className: "text-end tabular-nums", cell: (s) => (s.minPrice !== null ? formatPrice(s.minPrice) : "—") },
          {
            header: "Local",
            cell: (s) => (
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                <ActionButton
                  action={adminCatalogToggleAction}
                  fields={{ kind: "service", id: String(s.id), active: String(!s.isActive) }}
                  label={s.isActive ? "Disable" : "Enable"}
                  tone={s.isActive ? "outline" : "primary"}
                  size="xs"
                />
                <ActionButton action={adminServicePopularAction} fields={{ id: String(s.id), popular: String(!s.isPopular) }} label={s.isPopular ? "Unfeature" : "Feature"} size="xs" />
              </span>
            ),
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/services", sp)} />
    </Card>
  );
}
