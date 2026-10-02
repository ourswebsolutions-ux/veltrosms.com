import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, CustomMarginDialog } from "@/components/admin/AdminForms";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { formatPrice, formatShortDateTime } from "@/lib/format";
import { toDecimalString } from "@/lib/money";
import { adminMarginCreateAction, adminMarginDeleteAction, adminMarginUpdateAction } from "@/server/actions/admin";
import { listMarginRules, marginFormOptions } from "@/server/admin/margins";
import { requireAdminPage } from "@/server/admin/guard";

export const metadata: Metadata = { title: "Custom Margins" };

const plain = (minor: number) => toDecimalString(minor).replace(/(\.\d\d\d*?)0+$/, "$1");

/**
 * Service + country exceptions to the global pricing rule. The global rule
 * (Admin → Pricing) stays the default for everything without a rule here.
 */
export default async function AdminCustomMarginsPage() {
  await requireAdminPage("/admin/custom-margins");
  const [{ rules, globalMinMargin, currency }, options] = await Promise.all([listMarginRules(), marginFormOptions()]);
  const global = formatPrice(globalMinMargin, currency);

  return (
    <Card>
      <PageHeader
        title="Service Country Margins"
        description={
          <>
            Give one service in one country its own minimum margin. It replaces the global minimum margin ({global}) for that pair — it is not added to
            it — and the global markup still applies. Everything else uses the global rule on{" "}
            <Link href="/admin/pricing" className="text-primary hover:underline">
              Pricing
            </Link>
            .
          </>
        }
        actions={
          <CustomMarginDialog
            action={adminMarginCreateAction}
            services={options.services}
            countries={options.countries}
            currency={currency}
            globalMinMargin={global}
            trigger={{ label: "+ Add Custom Margin", tone: "primary" }}
          />
        }
      />
      <AdminTable
        rows={rules}
        rowKey={(r) => String(r.id)}
        empty={<EmptyState compact icon="trendingUp" title="No custom margins" description={`Every service and country uses the global minimum margin (${global}).`} />}
        columns={[
          { header: "Service", className: "font-medium", cell: (r) => <span className="flex items-center gap-2"><ServiceAvatar logo={r.service.logo} size={20} />{r.service.name}</span> },
          {
            header: "Country",
            cell: (r) => (
              <span className="inline-flex items-center gap-2">
                <CountryFlag iso2={r.country.iso2} />
                {r.country.name}
              </span>
            ),
          },
          { header: "Minimum margin", className: "text-end tabular-nums font-semibold", cell: (r) => formatPrice(r.minMargin, currency) },
          {
            header: "Current price",
            className: "text-end tabular-nums",
            desktopOnly: true,
            cell: (r) =>
              r.offer ? (
                <span title={`Provider cost ${formatPrice(r.offer.providerCost, r.offer.providerCurrency)}`}>
                  {formatPrice(r.offer.price, currency)}
                  {r.offer.priceOverride && (
                    <Badge tone="neutral" className="ms-1.5">
                      Manual price
                    </Badge>
                  )}
                </span>
              ) : (
                <span className="text-fg-muted">Not listed</span>
              ),
          },
          { header: "Updated", className: "whitespace-nowrap ps-6 text-fg-muted", desktopOnly: true, cell: (r) => formatShortDateTime(r.updatedAt) },
          {
            header: "Actions",
            cell: (r) => (
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                <CustomMarginDialog
                  action={adminMarginUpdateAction}
                  services={options.services}
                  countries={options.countries}
                  currency={currency}
                  globalMinMargin={global}
                  initial={{ id: r.id, serviceId: r.service.id, countryId: r.country.id, minMargin: plain(r.minMargin) }}
                  trigger={{ label: "Edit", size: "xs" }}
                />
                <ActionButton
                  action={adminMarginDeleteAction}
                  fields={{ id: String(r.id) }}
                  label="Delete"
                  tone="danger"
                  size="xs"
                  confirm={{
                    title: "Delete this custom margin?",
                    body: `${r.service.name} · ${r.country.name} will use the global minimum margin (${global}) again. Its price is recalculated now. The change is audited.`,
                    cta: "Delete custom margin",
                  }}
                />
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}
