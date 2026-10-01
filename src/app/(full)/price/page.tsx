import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { PriceExplorer, type PriceMode } from "@/components/marketplace/PriceExplorer";
import { ActiveOrdersList } from "@/components/orders/ActiveOrdersList";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { getCurrentUser } from "@/server/auth/session";
import { getViewer } from "@/server/services/account.service";
import { listActiveOrders } from "@/server/services/order.service";
import {
  getCountry,
  getOffersForCountry,
  getOffersForService,
  getService,
  listCountries,
  listServices,
} from "@/server/services/catalog.service";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("price.metaTitle"), description: t("price.metaDescription") };
}

/** Provider code shown first (Telegram); falls back to the first service on sale. */
const PREFERRED_SERVICE = "tg";

export default async function PricePage({ searchParams }: PageProps<"/price">) {
  const params = await searchParams;
  const serviceParam = typeof params.service === "string" ? params.service : undefined;
  const countryParam = typeof params.country === "string" ? params.country : undefined;

  const countryMatch = countryParam ? await getCountry(countryParam) : null;
  const mode: PriceMode = countryMatch ? "country" : "service";

  const user = await getCurrentUser();
  const [services, countries, viewer, active] = await Promise.all([
    listServices(),
    listCountries(),
    getViewer(),
    user ? listActiveOrders(user.id) : null,
  ]);
  const service =
    (serviceParam && (await getService(serviceParam)) ? serviceParam : null) ??
    services.find((s) => s.slug === PREFERRED_SERVICE)?.slug ??
    services[0]?.slug ??
    "";
  const country = countryMatch?.id ?? countries[0]?.id ?? "";
  const t = await getT();
  const initialResult =
    mode === "service" ? await getOffersForService(service) : await getOffersForCountry(country);

  return (
    <PageContainer size="form" className="max-w-[900px] space-y-4">
      <Card className="sm:!p-8">
        <PageHeader
          title={t("price.title")}
          description={t("price.intro")}
          actions={
            viewer.signedIn ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted py-1 pe-1 ps-3">
                <span className="text-sm text-fg-muted">{t("common.balance")}</span>
                <span className="font-semibold tabular-nums">
                  <Money amount={viewer.balance} currency={viewer.currency} variant="both" />
                </span>
                <ButtonLink href="/profile/top-up" size="sm" variant="soft">
                  <Icon name="plus" size={16} /> {t("nav.topUp")}
                </ButtonLink>
              </div>
            ) : (
              <ButtonLink href="/login" size="sm" variant="outline">
                {t("price.loginToBuy")}
              </ButtonLink>
            )
          }
        />
        <PriceExplorer
          services={services}
          countries={countries}
          initialMode={mode}
          initialService={service}
          initialCountry={country}
          initialResult={initialResult}
          viewer={viewer}
        />
      </Card>

      {active && (
        <Card id="active" className="sm:!p-8">
          <PageHeader
            as="h2"
            title={t("market.yourActive")}
            description={t("price.activeIntro")}
            actions={
              <ButtonLink href="/profile/history" size="sm" variant="ghost">
                {t("price.orderHistory")} <Icon name="arrowRight" size={16} />
              </ButtonLink>
            }
          />
          <ActiveOrdersList
            orders={active}
            className="md:grid-cols-2"
            empty={
              <EmptyState
                compact
                icon="phone"
                title={t("price.noActive")}
                description={t("price.noActiveHint")}
              />
            }
          />
        </Card>
      )}
    </PageContainer>
  );
}
