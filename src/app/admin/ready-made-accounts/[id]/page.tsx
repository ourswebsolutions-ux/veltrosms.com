import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReadyMadeOfferForm } from "@/components/admin/AdminForms";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { toDecimalString } from "@/lib/money";
import { adminReadyMadeUpdateAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { getReadyMadeOffer, readyMadeFormOptions } from "@/server/admin/ready-made";

export const metadata: Metadata = { title: "Edit Ready Made offer" };

export default async function AdminReadyMadeOfferPage({ params }: PageProps<"/admin/ready-made-accounts/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/ready-made-accounts/${id}`);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const offer = await getReadyMadeOffer(n);
  if (!offer) notFound();
  const options = await readyMadeFormOptions({ serviceId: offer.service.id, countryId: offer.country?.id ?? null });
  const title = `${offer.service.name} · ${offer.country?.name ?? "All countries"}`;

  return (
    <Card>
      <Breadcrumbs items={[{ label: "Ready Made Accounts", href: "/admin/ready-made-accounts" }, { label: title }]} className="mb-3" />
      <PageHeader title={title} description="Edit the service, country, price or status of this Ready Made offer. Changes are audited." />
      <ReadyMadeOfferForm
        action={adminReadyMadeUpdateAction}
        services={options.services}
        countries={options.countries}
        currency={options.currency}
        initial={{ id: offer.id, serviceId: offer.service.id, countryId: offer.country?.id ?? null, price: toDecimalString(offer.price).replace(/(\.\d\d\d*?)0+$/, "$1"), isActive: offer.isActive }}
        submitLabel="Save changes"
      />
    </Card>
  );
}
