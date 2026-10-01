"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Money } from "@/components/currency/DisplayCurrency";
import { StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { Input, SearchInput } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { Table, TBody, Td, Th, THead, Tr, type SortDirection } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatQty } from "@/lib/format";
import { parseAmount } from "@/lib/money";
import type { Availability, CountrySummary, OfferGroup, Result, ServiceSummary } from "@/types/catalog";
import { CountrySelector } from "./CountrySelector";
import { PurchaseDialog, type PurchaseIntent, type Viewer } from "./PurchaseDialog";
import { ServiceSelector } from "./ServiceSelector";
import { useOffers } from "./useOffers";

export type PriceMode = "service" | "country";
type SortKey = "name" | "price" | "qty" | "availability";
type AvailabilityFilter = "any" | "medium" | "high";

const PAGE_SIZE = 25;
const AVAILABILITY_RANK: Record<Availability, number> = { high: 3, medium: 2, low: 1 };
const AVAILABILITY_LABEL: Record<Availability, { label: string; tone: "success" | "warning" | "danger" }> = {
  high: { label: "High", tone: "success" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "danger" },
};

/**
 * The /price marketplace table: browse by service (rows = countries) or by
 * country (rows = services). Selection is mirrored into the URL so views are
 * shareable.
 */
export function PriceExplorer({
  services,
  countries,
  initialMode,
  initialService,
  initialCountry,
  initialResult,
  viewer,
}: {
  services: ServiceSummary[];
  countries: CountrySummary[];
  initialMode: PriceMode;
  initialService: string;
  initialCountry: string;
  initialResult: Result<OfferGroup[]>;
  viewer: Viewer;
}) {
  const [mode, setMode] = useState<PriceMode>(initialMode);
  const [serviceSlug, setServiceSlug] = useState(initialService);
  const [countryId, setCountryId] = useState(initialCountry);
  const [filter, setFilter] = useState("");
  const [minAvailability, setMinAvailability] = useState<AvailabilityFilter>("any");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  // Exact decimal parsing (no floats); an unparsable value is shown as invalid and ignored.
  const maxPrice = maxPriceInput.trim() ? parseAmount(maxPriceInput.replace(",", ".")) : null;
  const maxPriceInvalid = maxPriceInput.trim() !== "" && maxPrice === null;
  const [sort, setSort] = useState<{ key: SortKey; dir: Exclude<SortDirection, null> }>({
    key: "availability",
    dir: "desc",
  });
  const [showAll, setShowAll] = useState(false);
  const [intent, setIntent] = useState<PurchaseIntent | null>(null);

  const query = mode === "service" ? { service: serviceSlug } : { country: countryId };
  const initialKey = initialMode === "service" ? `service=${initialService}` : `country=${initialCountry}`;
  const { state, reload } = useOffers(query, { key: initialKey, result: initialResult });

  function syncUrl(next: { mode: PriceMode; service: string; country: string }) {
    const params = new URLSearchParams(
      next.mode === "service" ? { service: next.service } : { country: next.country },
    );
    window.history.replaceState(null, "", `?${params}`);
  }

  function changeMode(next: PriceMode) {
    setMode(next);
    setFilter("");
    setShowAll(false);
    syncUrl({ mode: next, service: serviceSlug, country: countryId });
  }

  const rowName = (g: OfferGroup) => (mode === "service" ? g.country.name : g.service.name);

  const rows = useMemo(() => {
    if (state.status !== "ok") return [];
    const q = filter.trim().toLowerCase();
    const sign = sort.dir === "asc" ? 1 : -1;
    const minRank = minAvailability === "high" ? 3 : minAvailability === "medium" ? 2 : 0;
    return state.data
      .filter((g) => !q || rowName(g).toLowerCase().includes(q))
      .filter((g) => AVAILABILITY_RANK[g.availability] >= minRank)
      .filter((g) => maxPrice === null || g.minPrice <= maxPrice)
      .sort((a, b) => {
        switch (sort.key) {
          case "name":
            return sign * rowName(a).localeCompare(rowName(b));
          case "price":
            return sign * (a.minPrice - b.minPrice);
          case "qty":
            return sign * (a.totalAvailable - b.totalAvailable);
          case "availability":
            return (
              sign * (AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability]) ||
              b.totalAvailable - a.totalAvailable
            );
        }
      });
    // rowName depends only on mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, filter, sort, mode, minAvailability, maxPrice]);

  const narrowed = Boolean(filter || minAvailability !== "any" || maxPriceInput.trim());
  const visible = showAll || narrowed ? rows : rows.slice(0, PAGE_SIZE);

  function clearFilters() {
    setFilter("");
    setMinAvailability("any");
    setMaxPriceInput("");
  }

  const sortProps = (key: SortKey) => ({
    sort: sort.key === key ? sort.dir : null,
    onSort: () =>
      setSort((s) =>
        s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "price" ? "asc" : "desc" },
      ),
  });

  return (
    <>
      <SegmentedTabs
        label="Browse prices by"
        value={mode}
        onChange={changeMode}
        items={[
          { value: "service", label: "Search by service" },
          { value: "country", label: "Search by country" },
        ]}
        className="w-full sm:w-auto"
      />

      <h2 className="mt-7 mb-3 flex items-center gap-2 text-lg font-semibold">
        <Icon name="box" className="text-primary" />
        {mode === "service" ? "Select service" : "Select country"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {mode === "service" ? (
          <ServiceSelector
            variant="select"
            services={services}
            value={serviceSlug}
            onChange={(v) => {
              setServiceSlug(v);
              setShowAll(false);
              syncUrl({ mode, service: v, country: countryId });
            }}
          />
        ) : (
          <CountrySelector
            countries={countries}
            value={countryId}
            onChange={(v) => {
              setCountryId(v);
              setShowAll(false);
              syncUrl({ mode, service: serviceSlug, country: v });
            }}
          />
        )}
        <SearchInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={mode === "service" ? "Search by country" : "Search by service"}
          aria-label={mode === "service" ? "Filter countries" : "Filter services"}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className="grid min-w-40 flex-1 gap-1 text-xs text-fg-muted sm:flex-none">
          Availability
          <Select
            value={minAvailability}
            onChange={(e) => setMinAvailability(e.target.value as AvailabilityFilter)}
            className="[&_select]:h-10 [&_select]:text-sm"
            options={[
              { value: "any", label: "Any availability" },
              { value: "medium", label: "Medium or high" },
              { value: "high", label: "High only" },
            ]}
          />
        </label>
        <label className="grid w-36 gap-1 text-xs text-fg-muted">
          Max price ({state.status === "ok" ? (state.data[0]?.currency ?? "USD") : "USD"})
          <Input
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            inputMode="decimal"
            placeholder="Any"
            aria-invalid={maxPriceInvalid || undefined}
            className={cn("h-10 min-w-0 px-3 text-sm", maxPriceInvalid && "border-danger")}
          />
        </label>
        {narrowed && (
          <button type="button" onClick={clearFilters} className="h-10 px-1 text-sm text-primary hover:underline">
            Clear filters
          </button>
        )}
        {state.status === "ok" && (
          <p className="ml-auto h-10 content-center text-[13px] text-fg-muted" aria-live="polite">
            {rows.length} of {state.data.length} {mode === "service" ? "countries" : "services"}
          </p>
        )}
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState
            description={state.message}
            action={
              <Button variant="outline" onClick={reload}>
                <Icon name="refresh" size={18} /> Try again
              </Button>
            }
          />
        ) : state.status === "unavailable" ? (
          <EmptyState icon="phone" title="Prices coming soon" description={state.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="search"
            title={narrowed ? "Nothing matches your filters" : "No numbers in stock"}
            description={narrowed ? "Try a different name, availability or price." : "Try another selection or check back soon."}
            action={
              narrowed ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Tablet/desktop: table */}
            <Table className="hidden sm:table">
              <THead>
                <tr>
                  <Th {...sortProps("name")}>{mode === "service" ? "Country" : "Service"}</Th>
                  <Th {...sortProps("price")}>Price</Th>
                  <Th {...sortProps("qty")}>Quantity</Th>
                  <Th {...sortProps("availability")}>Availability</Th>
                  <Th className="w-px">
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {visible.map((g) => (
                  <Tr key={`${g.service.slug}-${g.country.id}`} className="hover:bg-surface-muted/60">
                    <Td>
                      <span className="flex items-center gap-2 font-medium">
                        {mode === "service" ? (
                          <CountryFlag iso2={g.country.iso2} />
                        ) : (
                          <ServiceAvatar name={g.service.name} color={g.service.color} logo={g.service.logo} size={20} />
                        )}
                        {rowName(g)}
                      </span>
                    </Td>
                    <Td className="tabular-nums">
                      <Money amount={g.minPrice} currency={g.currency} />
                    </Td>
                    <Td className="tabular-nums">{formatQty(g.totalAvailable)}</Td>
                    <Td>
                      <StatusDot tone={AVAILABILITY_LABEL[g.availability].tone}>
                        {AVAILABILITY_LABEL[g.availability].label}
                      </StatusDot>
                    </Td>
                    <Td className="pr-0 text-right">
                      <Button
                        size="xs"
                        variant="soft"
                        onClick={() => setIntent({ group: g, tier: lowestTier(g) })}
                      >
                        Buy
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            {/* Phone: stacked rows */}
            <ul className="sm:hidden">
              {visible.map((g) => (
                <li key={`${g.service.slug}-${g.country.id}`} className="border-b border-line py-2.5 last:border-0">
                  <button
                    type="button"
                    onClick={() => setIntent({ group: g, tier: lowestTier(g) })}
                    className="w-full text-left"
                  >
                    <span className="flex items-center gap-2 text-[15px] font-medium">
                      {mode === "service" ? (
                        <CountryFlag iso2={g.country.iso2} />
                      ) : (
                        <ServiceAvatar name={g.service.name} color={g.service.color} logo={g.service.logo} size={20} />
                      )}
                      {rowName(g)}
                    </span>
                    <span className="mt-1 grid grid-cols-[1fr_1.4fr_1.2fr] text-[15px] tabular-nums">
                      <Money amount={g.minPrice} currency={g.currency} />
                      <span>{formatQty(g.totalAvailable)}</span>
                      <StatusDot tone={AVAILABILITY_LABEL[g.availability].tone}>
                        {AVAILABILITY_LABEL[g.availability].label}
                      </StatusDot>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {rows.length > visible.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-4 w-full rounded-lg border border-primary-tint-border bg-primary-tint py-2 text-sm font-medium text-primary hover:border-primary"
              >
                Show all {mode === "service" ? "countries" : "services"} ({rows.length})
              </button>
            )}
          </>
        )}
      </div>
      <PurchaseDialog intent={intent} viewer={viewer} onClose={() => setIntent(null)} />
    </>
  );
}

function lowestTier(g: OfferGroup) {
  return g.tiers.reduce((min, t) => (t.price < min.price ? t : min), g.tiers[0]);
}
