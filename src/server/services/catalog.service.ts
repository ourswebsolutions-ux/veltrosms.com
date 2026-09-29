import "server-only";
import { loadPricingRules } from "./pricing-rules";
import { toDecimalString, toMinor } from "@/lib/money";
import { isoForCountryName } from "@/server/catalog/country-iso";
import { popularRank, serviceColor } from "@/server/catalog/service-hints";
import { db, Prisma } from "@/server/db";
import { env } from "@/server/env";
import { getProvider } from "@/server/providers/registry";
import { ProviderError, type ProviderInventory } from "@/server/providers/types";
import type { Availability, CountrySummary, OfferGroup, PriceTier, Result, ServiceSummary } from "@/types/catalog";
import { customerPrice, platformCurrency, providerCurrency } from "./currency";

/**
 * Catalog = countries, services and prices, synced from the provider into the
 * database. Pages read from the database; a background sync keeps it fresh.
 */

const SYNC_KEY = "catalog.sync";
const SYNC_LOCK_MS = 5 * 60_000;
const INVENTORY_CACHE_MS = 60_000;
const BATCH = 500;

type SyncState = { lastSuccessAt?: string; lastError?: string; lastErrorAt?: string; lockedUntil?: string };

/* ------------------------------------------------------------------ sync -- */

/** MySQL DATETIME(3) literal in UTC (matches how Prisma stores dates). */
const sqlDate = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");

async function readSyncState(): Promise<SyncState> {
  const row = await db().setting.findUnique({ where: { key: SYNC_KEY } });
  return (row?.value as SyncState | undefined) ?? {};
}

async function writeSyncState(patch: SyncState) {
  const value = { ...(await readSyncState()), ...patch };
  await db().setting.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY, value }, update: { value } });
}

/** Takes the sync lock if free. Returns false when another sync is running. */
async function acquireLock(): Promise<boolean> {
  return db().$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY, value: {} }, update: {} });
    const rows = await tx.$queryRaw<{ value: string }[]>`SELECT value FROM settings WHERE \`key\` = ${SYNC_KEY} FOR UPDATE`;
    const state = (typeof rows[0]?.value === "string" ? JSON.parse(rows[0].value) : rows[0]?.value ?? {}) as SyncState;
    if (state.lockedUntil && Date.parse(state.lockedUntil) > Date.now()) return false;
    const value = { ...state, lockedUntil: new Date(Date.now() + SYNC_LOCK_MS).toISOString() };
    await tx.setting.update({ where: { key: SYNC_KEY }, data: { value } });
    return true;
  });
}

export type SyncReport = { countries: number; services: number; prices: number; deactivated: number };

/** Pulls countries, services and prices from the provider into the database. */
export async function syncCatalog(): Promise<SyncReport | null> {
  await loadPricingRules(); // customer prices use the admin-set markup
  if (!(await acquireLock())) return null;
  const provider = getProvider();
  const started = new Date();
  try {
    const [countries, services, prices] = await Promise.all([
      provider.getCountries(),
      provider.getServices(),
      provider.getPrices(),
    ]);
    const now = sqlDate(started);

    for (let i = 0; i < countries.length; i += BATCH) {
      const rows = countries.slice(i, i + BATCH).map(
        (c) => Prisma.sql`(${provider.id}, ${c.providerCode}, ${c.name.slice(0, 120)}, ${isoForCountryName(c.name)}, 1, ${c.visible ? 1 : 0}, 1000, ${now}, ${now})`,
      );
      // is_active is the admin switch and is never overwritten by a sync.
      await db().$executeRaw`
        INSERT INTO countries (provider, provider_code, name, iso2, is_active, provider_active, display_order, created_at, updated_at)
        VALUES ${Prisma.join(rows)}
        ON DUPLICATE KEY UPDATE name = VALUES(name), iso2 = VALUES(iso2), provider_active = VALUES(provider_active), updated_at = VALUES(updated_at)`;
    }

    for (let i = 0; i < services.length; i += BATCH) {
      const rows = services.slice(i, i + BATCH).map((s) => {
        const rank = popularRank(s.providerCode);
        const slug = s.providerCode.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 64);
        return Prisma.sql`(${provider.id}, ${s.providerCode}, ${slug}, ${s.name.slice(0, 120)}, ${rank !== null ? 1 : 0}, 1, 1, ${rank ?? 1000}, ${now}, ${now})`;
      });
      await db().$executeRaw`
        INSERT INTO services (provider, provider_code, slug, name, is_popular, is_active, provider_active, display_order, created_at, updated_at)
        VALUES ${Prisma.join(rows)}
        ON DUPLICATE KEY UPDATE name = VALUES(name), provider_active = 1, updated_at = VALUES(updated_at)`;
    }

    const [countryRows, serviceRows] = await Promise.all([
      db().country.findMany({ where: { provider: provider.id }, select: { id: true, providerCode: true } }),
      db().service.findMany({ where: { provider: provider.id }, select: { id: true, providerCode: true } }),
    ]);
    const countryId = new Map(countryRows.map((r) => [r.providerCode, r.id]));
    const serviceId = new Map(serviceRows.map((r) => [r.providerCode, r.id]));
    const platform = platformCurrency().code;
    const providerCur = providerCurrency().code;

    const priceRows = prices
      .map((p) => ({ ...p, cId: countryId.get(p.countryCode), sId: serviceId.get(p.serviceCode) }))
      .filter((p) => p.cId && p.sId);
    for (let i = 0; i < priceRows.length; i += BATCH) {
      const rows = priceRows.slice(i, i + BATCH).map(
        (p) => Prisma.sql`(${p.sId}, ${p.cId}, ${toDecimalString(p.cost)}, ${providerCur}, ${toDecimalString(customerPrice(p.cost))}, ${platform}, ${p.count}, ${p.count > 0 ? 1 : 0}, ${now}, ${now}, ${now})`,
      );
      await db().$executeRaw`
        INSERT INTO prices (service_id, country_id, provider_cost, provider_currency, price, currency, available, is_active, synced_at, created_at, updated_at)
        VALUES ${Prisma.join(rows)}
        ON DUPLICATE KEY UPDATE provider_cost = VALUES(provider_cost), provider_currency = VALUES(provider_currency),
          price = VALUES(price), currency = VALUES(currency), available = VALUES(available),
          is_active = VALUES(is_active), synced_at = VALUES(synced_at), updated_at = VALUES(updated_at)`;
    }

    // Countries/services the provider no longer lists are provider-inactive.
    await db().country.updateMany({ where: { provider: provider.id, updatedAt: { lt: started } }, data: { providerActive: false } });
    await db().service.updateMany({ where: { provider: provider.id, updatedAt: { lt: started } }, data: { providerActive: false } });

    // Offers the provider no longer lists are out of stock.
    const { count: deactivated } = await db().price.updateMany({
      where: { syncedAt: { lt: started }, isActive: true },
      data: { isActive: false, available: 0 },
    });

    await writeSyncState({ lastSuccessAt: started.toISOString(), lockedUntil: new Date(0).toISOString() });
    inventoryCache.clear();
    return { countries: countries.length, services: services.length, prices: priceRows.length, deactivated };
  } catch (error) {
    await writeSyncState({
      lastError: error instanceof Error ? error.message.slice(0, 200) : "unknown error",
      lastErrorAt: new Date().toISOString(),
      lockedUntil: new Date(0).toISOString(),
    }).catch(() => {});
    throw error;
  }
}

let inFlight: Promise<unknown> | undefined;

/**
 * Keeps the catalog fresh without ever blocking a page: a stale catalog is
 * refreshed in the background (the full price list takes ~30 s to download).
 * Run `npm run catalog:sync` once after setup to load it the first time.
 */
export async function ensureCatalogFresh(): Promise<void> {
  // `next build` renders pages to collect data: never call the provider from a build.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!getProvider().capabilities.has("catalog")) return;
  const state = await readSyncState();
  const last = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : 0;
  if (Date.now() - last < env().CATALOG_SYNC_MINUTES * 60_000) return;

  inFlight ??= syncCatalog()
    .catch((error: unknown) => console.error("[catalog] sync failed:", error instanceof Error ? error.message : error))
    .finally(() => {
      inFlight = undefined;
    });
}

export async function getCatalogStatus() {
  const state = await readSyncState();
  return {
    configured: getProvider().capabilities.has("catalog"),
    lastSuccessAt: state.lastSuccessAt ?? null,
    lastError: state.lastErrorAt && (!state.lastSuccessAt || state.lastErrorAt > state.lastSuccessAt) ? state.lastError ?? null : null,
  };
}

/* ----------------------------------------------------------------- reads -- */

const unavailable = (reason: "not_configured" | "upstream_error", message: string): Result<never> => ({
  status: "unavailable",
  reason,
  message,
});

function notConfigured() {
  return unavailable("not_configured", "Number availability will appear here once the provider is connected.");
}

type ServiceRow = { id: number; slug: string; name: string; providerCode: string; isPopular: boolean };
type CountryRow = { id: number; name: string; iso2: string | null };

const toService = (s: ServiceRow): ServiceSummary => ({
  slug: s.slug,
  name: s.name,
  color: serviceColor(s.providerCode, s.name),
  popular: s.isPopular,
});
const toCountry = (c: CountryRow): CountrySummary => ({ id: String(c.id), iso2: c.iso2, name: c.name });

export async function listServices(): Promise<ServiceSummary[]> {
  await ensureCatalogFresh().catch(() => {});
  const rows = await db().service.findMany({
    where: { isActive: true, providerActive: true, prices: { some: { isActive: true } } },
    orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, providerCode: true, isPopular: true },
  });
  return rows.map(toService);
}

export async function listCountries(): Promise<CountrySummary[]> {
  await ensureCatalogFresh().catch(() => {});
  const rows = await db().country.findMany({
    where: { isActive: true, providerActive: true, prices: { some: { isActive: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, iso2: true },
  });
  return rows.map(toCountry);
}

export async function getService(slug: string): Promise<(ServiceSummary & { id: number; providerCode: string }) | null> {
  const s = await db().service.findFirst({
    where: { slug, isActive: true, providerActive: true },
    select: { id: true, slug: true, name: true, providerCode: true, isPopular: true },
  });
  return s ? { ...toService(s), id: s.id, providerCode: s.providerCode } : null;
}

export async function getCountry(id: string): Promise<(CountrySummary & { providerCode: string }) | null> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  const c = await db().country.findFirst({
    where: { id: n, isActive: true, providerActive: true },
    select: { id: true, name: true, iso2: true, providerCode: true },
  });
  return c ? { ...toCountry(c), providerCode: c.providerCode } : null;
}

function availabilityFor(total: number): Availability {
  if (total >= 1000) return "high";
  if (total >= 100) return "medium";
  return "low";
}

/* Live inventory per service (all countries), cached briefly in memory. */
const inventoryCache = new Map<string, { at: number; data: Map<string, ProviderInventory> }>();

async function liveInventory(serviceCode: string): Promise<Map<string, ProviderInventory> | null> {
  await loadPricingRules(); // customer prices use the admin-set markup
  const hit = inventoryCache.get(serviceCode);
  if (hit && Date.now() - hit.at < INVENTORY_CACHE_MS) return hit.data;
  try {
    const data = await getProvider().getInventory(serviceCode);
    inventoryCache.set(serviceCode, { at: Date.now(), data });
    return data;
  } catch (error) {
    console.warn("[catalog] live inventory unavailable:", error instanceof ProviderError ? error.code : error instanceof Error ? error.message : error);
    return null;
  }
}

type PriceRow = {
  providerCost: Prisma.Decimal;
  price: Prisma.Decimal;
  priceOverride: Prisma.Decimal | null;
  available: number;
  service: ServiceRow;
  country: CountryRow & { providerCode: string };
};

function toGroup(row: PriceRow, live: ProviderInventory | undefined): OfferGroup {
  const override = row.priceOverride ? toMinor(row.priceOverride) : null;
  // Live price levels when available, otherwise the synced cheapest offer.
  const list: PriceTier[] = live
    ? live.tiers.map((t) => ({ price: override ?? customerPrice(t.cost), available: t.count }))
    : [{ price: override ?? toMinor(row.price), available: row.available }];
  // Merge levels that end up at the same customer price.
  const merged = new Map<number, number>();
  for (const t of list) merged.set(t.price, (merged.get(t.price) ?? 0) + t.available);
  const sorted = [...merged].map(([price, available]) => ({ price, available })).sort((a, b) => b.price - a.price);
  const total = live?.count ?? sorted.reduce((s, t) => s + t.available, 0);
  return {
    service: toService(row.service),
    country: toCountry(row.country),
    minPrice: Math.min(...sorted.map((t) => t.price)),
    totalAvailable: total,
    availability: availabilityFor(total),
    tiers: sorted,
    currency: platformCurrency().code,
  };
}

const priceSelect = {
  providerCost: true,
  price: true,
  priceOverride: true,
  available: true,
  service: { select: { id: true, slug: true, name: true, providerCode: true, isPopular: true } },
  country: { select: { id: true, name: true, iso2: true, providerCode: true } },
} satisfies Prisma.PriceSelect;

async function withCatalog<T>(load: () => Promise<T>): Promise<Result<T>> {
  if (!getProvider().capabilities.has("catalog")) return notConfigured();
  try {
    await ensureCatalogFresh();
    return { status: "ok", source: "live", data: await load() };
  } catch (error) {
    if (error instanceof ProviderError && error.code === "NOT_CONFIGURED") return notConfigured();
    console.error("[catalog] load failed:", error instanceof Error ? error.message : error);
    return unavailable("upstream_error", "We couldn't load prices right now. Please try again shortly.");
  }
}

/** Offers for one service across all countries, most stock first. */
export async function getOffersForService(slug: string): Promise<Result<OfferGroup[]>> {
  return withCatalog(async () => {
    const rows = await db().price.findMany({
      where: { isActive: true, available: { gt: 0 }, service: { slug, isActive: true, providerActive: true }, country: { isActive: true, providerActive: true } },
      select: priceSelect,
    });
    if (!rows.length) return [];
    const live = await liveInventory(rows[0].service.providerCode);
    return rows
      // When live data is available it wins: countries it no longer stocks are hidden.
      .filter((r) => !live || live.has(r.country.providerCode))
      .map((r) => toGroup(r, live?.get(r.country.providerCode)))
      .sort((a, b) => b.totalAvailable - a.totalAvailable);
  });
}

/** Offers for one country (by our id) across all services. */
export async function getOffersForCountry(countryId: string): Promise<Result<OfferGroup[]>> {
  return withCatalog(async () => {
    const id = Number(countryId);
    if (!Number.isInteger(id)) return [];
    const rows = await db().price.findMany({
      where: { isActive: true, available: { gt: 0 }, countryId: id, service: { isActive: true, providerActive: true }, country: { providerActive: true } },
      select: priceSelect,
    });
    return rows
      .map((r) => toGroup(r, undefined))
      .sort((a, b) => Number(b.service.popular) - Number(a.service.popular) || a.service.name.localeCompare(b.service.name));
  });
}

/** Home page highlights: cheapest in-stock offer for each popular service. */
export async function getPopularOffers(limit = 12): Promise<Result<OfferGroup[]>> {
  return withCatalog(async () => {
    const rows = await db().price.findMany({
      where: { isActive: true, available: { gt: 0 }, service: { isPopular: true, isActive: true, providerActive: true }, country: { isActive: true, providerActive: true } },
      select: priceSelect,
      orderBy: { available: "desc" },
      take: 400,
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => r.service.providerCode !== "ot" && !seen.has(r.service.slug) && seen.add(r.service.slug))
      .slice(0, limit)
      .map((r) => toGroup(r, undefined));
  });
}

/**
 * Server-side quote used when buying: the current provider price level that
 * matches the customer price the user saw. Never trusts client prices.
 */
export async function quote(serviceSlug: string, countryId: string, expectedPrice: number) {
  await loadPricingRules(); // customer prices use the admin-set markup
  const id = Number(countryId);
  if (!Number.isInteger(id)) return null;
  const row = await db().price.findFirst({
    where: { isActive: true, available: { gt: 0 }, countryId: id, service: { slug: serviceSlug, isActive: true, providerActive: true }, country: { isActive: true, providerActive: true } },
    select: { ...priceSelect, serviceId: true, countryId: true },
  });
  if (!row) return null;
  const inventory = await liveInventory(row.service.providerCode);
  const live = inventory?.get(row.country.providerCode);
  // Live data says this offer is sold out: nothing to buy.
  if (inventory && !live) return null;
  const override = row.priceOverride ? toMinor(row.priceOverride) : null;
  const candidates = live
    ? live.tiers.map((t) => ({ providerCost: t.cost, price: override ?? customerPrice(t.cost) }))
    : [{ providerCost: toMinor(row.providerCost), price: override ?? toMinor(row.price) }];
  // The cheapest provider level that yields the price the customer agreed to.
  const match = candidates.filter((c) => c.price === expectedPrice).sort((a, b) => a.providerCost - b.providerCost)[0];
  return {
    serviceId: row.serviceId,
    countryId: row.countryId,
    serviceCode: row.service.providerCode,
    countryCode: row.country.providerCode,
    label: `${row.service.name} · ${row.country.name}`,
    match: match ?? null,
    currentPrices: [...new Set(candidates.map((c) => c.price))].sort((a, b) => a - b),
  };
}
