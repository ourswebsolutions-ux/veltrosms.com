import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ReadyMadeOfferForm } from "@/components/admin/AdminForms";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { serviceLogo } from "@/lib/service-logos";
import { adminReadyMadeCreateAction, adminReadyMadeDeleteAction, adminReadyMadeToggleAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { serviceColor } from "@/server/catalog/service-hints";
import { listReadyMadeOffers, readyMadeFormOptions } from "@/server/admin/ready-made";

export const metadata: Metadata = { title: "Ready Made Accounts" };

/**
 * Which services (and countries) are sold as Ready Made accounts, at which
 * admin-set price, and how many accounts are in hand for each (a purchase
 * takes one; at 0 the offer shows as out of stock and can't be bought).
 */
export default async function AdminReadyMadePage() {
  await requireAdminPage("/admin/ready-made-accounts");
  const [offers, options] = await Promise.all([listReadyMadeOffers(), readyMadeFormOptions()]);

  return (
    <>
      <Card>
        <PageHeader
          title="Ready Made Accounts"
          description="Choose which services are offered as Ready Made accounts, for all countries or one country, at a price you set. Provider prices and the normal number purchase are not affected."
        />
        <ReadyMadeOfferForm
          action={adminReadyMadeCreateAction}
          services={options.services}
          countries={options.countries}
          currency={options.currency}
          initial={{ serviceId: options.defaultServiceId, countryId: null, price: "", availableQuantity: "", isActive: true }}
          submitLabel="Add offer"
        />
      </Card>
      <Card>
        <PageHeader as="h2" title="Offers" description={`${offers.length} configured`} />
        <AdminTable
          rows={offers}
          rowKey={(o) => String(o.id)}
          empty={<EmptyState compact icon="box" title="No Ready Made offers yet" description="Add one above, for example WhatsApp for All countries." />}
          columns={[
            {
              header: "Service",
              cell: (o) => (
                <Link href={`/admin/ready-made-accounts/${o.id}`} className="inline-flex items-center gap-2 font-medium hover:text-primary">
                  <ServiceAvatar name={o.service.name} color={serviceColor(o.service.providerCode, o.service.name)} logo={serviceLogo(o.service.providerCode)} size={22} />
                  {o.service.name}
                  {!(o.service.isActive && o.service.providerActive) && (
                    <Badge tone="neutral" className="ms-1.5">
                      Service off
                    </Badge>
                  )}
                </Link>
              ),
            },
            {
              header: "Country",
              cell: (o) =>
                o.country ? (
                  <span className="inline-flex items-center gap-2">
                    <CountryFlag iso2={o.country.iso2} />
                    {o.country.name}
                  </span>
                ) : (
                  <span className="text-fg-muted">All countries</span>
                ),
            },
            { header: "Price", className: "text-end tabular-nums font-medium", cell: (o) => formatPrice(o.price, o.currency) },
            {
              header: "Available",
              className: "text-end tabular-nums",
              cell: (o) =>
                o.availableQuantity > 0 ? (
                  <span className="font-medium">{o.availableQuantity.toLocaleString("en-US")}</span>
                ) : (
                  <Badge tone="danger">Out of stock</Badge>
                ),
            },
            { header: "Currency", className: "ps-6", desktopOnly: true, cell: (o) => o.currency },
            { header: "Status", cell: (o) => (o.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>) },
            { header: "Updated", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (o) => formatShortDateTime(o.updatedAt) },
            {
              header: "Actions",
              cell: (o) => (
                <span className="inline-flex flex-wrap justify-end gap-1.5">
                  <Link
                    href={`/admin/ready-made-accounts/${o.id}`}
                    className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold text-primary ring-1 ring-primary hover:bg-primary-tint"
                  >
                    Edit
                  </Link>
                  <ActionButton
                    action={adminReadyMadeToggleAction}
                    fields={{ id: String(o.id), active: String(!o.isActive) }}
                    label={o.isActive ? "Disable" : "Enable"}
                    tone={o.isActive ? "outline" : "primary"}
                    size="xs"
                  />
                  <ActionButton
                    action={adminReadyMadeDeleteAction}
                    fields={{ id: String(o.id) }}
                    label="Delete"
                    tone="danger"
                    size="xs"
                    confirm={{
                      title: "Delete this Ready Made offer?",
                      body: `${o.service.name} · ${o.country?.name ?? "All countries"} will no longer be configured. You can add it again later. The deletion is audited.`,
                      cta: "Delete offer",
                    }}
                  />
                </span>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
