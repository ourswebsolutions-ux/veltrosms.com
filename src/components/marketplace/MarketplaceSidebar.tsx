"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ActiveOrdersList } from "@/components/orders/ActiveOrdersList";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import type { OrderListItem } from "@/types/account";
import type { OfferGroup, Result, ServiceSummary } from "@/types/catalog";
import { CountryOfferCard } from "./CountryOfferCard";
import { PurchaseDialog, type PurchaseIntent, type Viewer } from "./PurchaseDialog";
import { useFavorites } from "./useFavorites";
import { ServiceSelector } from "./ServiceSelector";
import { useOffers } from "./useOffers";
import { useT } from "@/i18n/client";

type SortKey = "top" | "qty" | "price";

/**
 * Left column shared by the home, FAQ and profile pages: pick a service, then
 * a country and price tier. On mobile it's shown on the home page only.
 */
export function MarketplaceSidebar({
  services,
  initialService,
  initialOffers,
  viewer,
  activeOrders = [],
}: {
  services: ServiceSummary[];
  initialService: string;
  initialOffers: Result<OfferGroup[]>;
  viewer: Viewer;
  /** The viewer's live numbers (server-rendered; each card then keeps itself fresh). */
  activeOrders?: OrderListItem[];
}) {
  const pathname = usePathname();
  // Keep the panel on the page where a number closed (to show its outcome);
  // it hides after navigating on once nothing is live. The profile overview
  // lists active numbers itself.
  const [activePath, setActivePath] = useState<string | null>(activeOrders.length ? pathname : null);
  if (activeOrders.length > 0 && activePath !== pathname) setActivePath(pathname);
  const showActive = pathname !== "/profile" && (activeOrders.length > 0 || activePath === pathname);
  const t = useT();
  const [serviceSlug, setServiceSlug] = useState(initialService);
  const service = services.find((s) => s.slug === serviceSlug) ?? services[0];

  if (!service) {
    return (
      <aside aria-label={t("market.buyNumber")} className={cn("flex-col gap-4", pathname === "/" ? "flex" : "hidden lg:flex")}>
        <Card>
          <CardHeader title={t("market.serviceSelection")} />
          {initialOffers.status === "unavailable" ? (
            <EmptyState compact icon="phone" title={t("home.comingSoon")} description={t.server(initialOffers.message)} />
          ) : (
            <EmptyState compact icon="phone" title={t("market.loadingCatalog")} description={t("market.loadingCatalogHint")} />
          )}
        </Card>
      </aside>
    );
  }

  return (
    <aside
      aria-label={t("market.buyNumber")}
      className={cn(
        "flex-col gap-4 lg:sticky lg:top-[130px] lg:max-h-[calc(100dvh-146px)] lg:min-h-[640px]",
        pathname === "/" ? "flex" : "hidden lg:flex",
      )}
    >
      {showActive && <ActiveNumbers key={pathname} orders={activeOrders} />}
      <Card className="shrink-0 !pb-5">
        <CardHeader title={t("market.serviceSelection")} action={{ label: t("market.allServices"), href: "/price" }} />
        <ServiceSelector services={services} value={service.slug} onChange={setServiceSlug} />
      </Card>
      <CountryPicker
        service={service}
        viewer={viewer}
        initial={{ key: `service=${initialService}`, result: initialOffers }}
      />
    </aside>
  );
}

function ActiveNumbers({ orders }: { orders: OrderListItem[] }) {
  const t = useT();
  return (
    <Card className="shrink-0 !pb-4" aria-label={t("market.yourActive")}>
      <CardHeader
        title={
          <>
            {t("market.activeNumbers")}
            {orders.length > 0 && <span className="text-fg-muted"> ({orders.length})</span>}
          </>
        }
        action={{ label: t("market.allOrders"), href: "/profile/history?tab=orders" }}
      />
      <ActiveOrdersList orders={orders} className="-mx-1 max-h-[340px] gap-2 overflow-y-auto px-1 scroll-thin" />
    </Card>
  );
}

function CountryPicker({
  service,
  viewer,
  initial,
}: {
  service: ServiceSummary;
  viewer: Viewer;
  initial: { key: string; result: Result<OfferGroup[]> };
}) {
  const { state, reload } = useOffers({ service: service.slug }, initial);
  const { favorites, toggle } = useFavorites();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "top", dir: "desc" });
  const [intent, setIntent] = useState<PurchaseIntent | null>(null);
  const t = useT();

  const groups = useMemo(() => {
    if (state.status !== "ok") return [];
    const q = query.trim().toLowerCase();
    const list = state.data.filter((g) => !q || g.country.name.toLowerCase().includes(q));
    const sign = sort.dir === "asc" ? 1 : -1;
    const value = (g: OfferGroup) =>
      sort.key === "price" ? g.minPrice : sort.key === "qty" ? g.totalAvailable : 0;
    return list
      .map((g, i) => ({ g, i }))
      .sort((a, b) => {
        const fav = Number(favorites.has(b.g.country.id)) - Number(favorites.has(a.g.country.id));
        if (fav) return fav;
        // "top" keeps the server's ranking.
        return sort.key === "top" ? a.i - b.i : sign * (value(a.g) - value(b.g));
      })
      .map(({ g }) => g);
  }, [state, query, sort, favorites]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "price" ? "asc" : "desc" },
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col !pb-2">
      <CardHeader
        title={
          <>
            {t("market.countryFor")} <span className="text-primary">{service.name}</span>
          </>
        }
        action={{ label: t("market.allCountries"), href: `/price?service=${service.slug}` }}
      />
      <SearchInput
        size="sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("market.searchCountry")}
        aria-label={t("market.searchCountry")}
      />
      <div className="mt-2.5 mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <SortButton active={sort.key === "top"} dir="desc" onClick={() => setSort({ key: "top", dir: "desc" })}>
          {t("market.topCountries")}
        </SortButton>
        <span className="ms-auto" />
        <SortButton active={sort.key === "qty"} dir={sort.dir} onClick={() => toggleSort("qty")}>
          {t("common.quantity")}
        </SortButton>
        <SortButton active={sort.key === "price"} dir={sort.dir} onClick={() => toggleSort("price")}>
          {t("common.price")}
        </SortButton>
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2 scroll-thin">
        {state.status === "loading" ? (
          <div className="space-y-1.5" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[46px] rounded-xl" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState
            compact
            description={t.server(state.message)}
            action={
              <Button size="sm" variant="outline" onClick={reload}>
                <Icon name="refresh" size={16} /> {t("common.retry")}
              </Button>
            }
          />
        ) : state.status === "unavailable" ? (
          <EmptyState compact icon="phone" title={t("home.comingSoon")} description={t.server(state.message)} />
        ) : groups.length === 0 ? (
          <EmptyState
            compact
            icon="search"
            title={query ? t("market.noMatchingCountries") : t("market.noNumbersNow")}
            description={
              query ? t("market.tryOtherCountry") : t("market.nothingFor", { service: service.name })
            }
          />
        ) : (
          <ul className="space-y-1.5">
            {groups.map((g) => (
              <CountryOfferCard
                key={g.country.id}
                group={g}
                favorite={favorites.has(g.country.id)}
                onToggleFavorite={() => toggle(g.country.id)}
                onSelect={(tier) => setIntent({ group: g, tier })}
              />
            ))}
          </ul>
        )}
      </div>
      <PurchaseDialog intent={intent} viewer={viewer} onClose={() => setIntent(null)} />
    </Card>
  );
}

function SortButton({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex items-center gap-0.5 whitespace-nowrap", active ? "font-medium text-fg" : "text-fg-muted hover:text-fg")}
    >
      {children}
      <Icon
        name="caretDown"
        size={14}
        className={cn(active ? "text-primary" : "text-fg-subtle", active && dir === "asc" && "rotate-180")}
      />
    </button>
  );
}
