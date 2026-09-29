import type { Metadata } from "next";
import { PricingForm } from "@/components/admin/AdminForms";
import { KeyValues } from "@/components/admin/AdminParts";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatPrice } from "@/lib/format";
import { adminSavePricingAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { getPricing } from "@/server/admin/platform";
import { customerPrice } from "@/server/services/currency";

export const metadata: Metadata = { title: "Pricing" };

const EXAMPLES = [100, 3500, 25000, 150000]; // provider costs in minor units

/**
 * The platform's single pricing rule: provider cost × FX × (1 + markup%),
 * never below cost + minimum margin. Prices are always computed on the server.
 */
export default async function AdminPricingPage() {
  await requireAdminPage("/admin/pricing");
  const p = await getPricing();
  const rules = p.current;

  return (
    <>
      <Card>
        <PageHeader title="Pricing" description="One markup rule over provider costs, applied to every service and country." />
        <PricingForm action={adminSavePricingAction} markupPercent={rules.markupPercent} minMargin={rules.minMargin} currency={p.currency} />
      </Card>
      <Card>
        <PageHeader as="h2" title="How prices are calculated" />
        <KeyValues
          rows={[
            ["Rule", `cost × ${p.fxRate} (${p.providerCurrency} → ${p.currency}) × (1 + markup), at least cost + margin, rounded up to 0.001`],
            ["Environment defaults", `${p.defaults.markupPercent}% markup · ${p.defaults.minMargin} ${p.currency} minimum margin`],
          ]}
        />
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          {EXAMPLES.map((cost) => (
            <div key={cost} className="rounded-lg bg-surface-muted px-3 py-2">
              <p className="text-fg-muted">Cost {formatPrice(cost, p.providerCurrency)}</p>
              <p className="font-semibold tabular-nums">Customer pays {formatPrice(customerPrice(cost, rules), p.currency)}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
