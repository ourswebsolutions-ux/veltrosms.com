import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/AdminForms";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { one, pageHref, pageParam } from "@/components/admin/AdminParts";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CountryFlag } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { formatShortDateTime } from "@/lib/format";
import { adminCatalogToggleAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { listAdminCountries } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Countries" };

const STATES = ["enabled", "disabled", "provider_off"] as const;

export default async function AdminCountriesPage({ searchParams }: PageProps<"/admin/countries">) {
  await requireAdminPage("/admin/countries");
  const sp = await searchParams;
  const q = one(sp.q);
  const state = STATES.find((s) => s === one(sp.state));
  const data = await listAdminCountries({ q, state, page: pageParam(sp.page) });

  return (
    <Card>
      <PageHeader
        title="Countries"
        description="Imported from the provider. Disabling hides a country locally; the provider's own availability is shown separately and can't be edited."
      />
      <AdminFilters
        action="/admin/countries"
        active={Boolean(q || state)}
        fields={[
          { kind: "search", name: "q", placeholder: "Name or provider ID", value: q },
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
        rowKey={(c) => String(c.id)}
        empty={<EmptyState compact icon="globe" title="No countries" description="Countries appear after a catalog sync." />}
        columns={[
          { header: "Country", cell: (c) => <span className="inline-flex items-center gap-2 font-medium"><CountryFlag iso2={c.iso2} />{c.name}</span> },
          { header: "Provider ID", className: "font-mono text-xs", cell: (c) => c.providerCode },
          { header: "Provider", cell: (c) => (c.providerActive ? <Badge tone="success">Listed</Badge> : <Badge tone="neutral">Not listed</Badge>) },
          { header: "Services in stock", className: "text-right tabular-nums", cell: (c) => c.servicesInStock },
          { header: "Synced", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (c) => (c.syncedAt ? formatShortDateTime(c.syncedAt) : "—") },
          {
            header: "Local",
            cell: (c) => (
              <ActionButton
                action={adminCatalogToggleAction}
                fields={{ kind: "country", id: String(c.id), active: String(!c.isActive) }}
                label={c.isActive ? "Disable" : "Enable"}
                tone={c.isActive ? "outline" : "primary"}
                size="xs"
              />
            ),
          },
        ]}
      />
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={pageHref("/admin/countries", sp)} />
    </Card>
  );
}
