import "server-only";
import { parseAmount, toDecimalString, toMinor } from "@/lib/money";
import { db, isUniqueViolation } from "@/server/db";
import { platformCurrency } from "@/server/services/currency";
import { audit } from "./audit";
import type { AdminActor } from "./guard";
import type { AdminResult } from "./users";

/**
 * Ready Made Accounts — admin configuration. Each offer is a service, either
 * for "All countries" (countryId null) or for one country, at a customer price
 * set here (never derived from provider prices). Provider-synced services and
 * countries are only referenced, never changed. Every change is audited.
 *
 * The database also enforces one offer per (service, country) — including
 * "All" — and a positive price (see the ready_made_offers migration).
 */

/** Provider code of the service preselected in the admin form (WhatsApp). */
const DEFAULT_SERVICE_CODE = "wa";
/** Upper bound for an admin-entered price, in units of the platform currency. */
const MAX_PRICE_UNITS = 100_000;

export type ReadyMadeOfferInput = {
  serviceId: number;
  /** null = All countries. */
  countryId: number | null;
  price: string;
  isActive: boolean;
};

export type ReadyMadeOfferRow = {
  id: number;
  service: { id: number; name: string; isActive: boolean; providerActive: boolean; providerCode: string };
  country: { id: number; name: string; iso2: string | null } | null;
  price: number;
  currency: string;
  isActive: boolean;
  updatedAt: string;
};

const offerInclude = {
  service: { select: { id: true, name: true, isActive: true, providerActive: true, providerCode: true } },
  country: { select: { id: true, name: true, iso2: true } },
} as const;

type OfferRecord = {
  id: number;
  price: { toString(): string };
  currency: string;
  isActive: boolean;
  updatedAt: Date;
  service: ReadyMadeOfferRow["service"];
  country: ReadyMadeOfferRow["country"];
};

const toRow = (o: OfferRecord): ReadyMadeOfferRow => ({
  id: o.id,
  service: o.service,
  country: o.country,
  price: toMinor(o.price),
  currency: o.currency,
  isActive: o.isActive,
  updatedAt: o.updatedAt.toISOString(),
});

const label = (o: { service: { name: string }; country: { name: string } | null }) =>
  `${o.service.name} · ${o.country?.name ?? "All countries"}`;

export async function listReadyMadeOffers(): Promise<ReadyMadeOfferRow[]> {
  const rows = await db().readyMadeOffer.findMany({
    include: offerInclude,
    orderBy: [{ service: { name: "asc" } }, { countryKey: "asc" }],
  });
  return rows.map(toRow);
}

export async function getReadyMadeOffer(id: number): Promise<ReadyMadeOfferRow | null> {
  const row = await db().readyMadeOffer.findUnique({ where: { id }, include: offerInclude });
  return row ? toRow(row) : null;
}

/**
 * Choices for the admin form: services and countries that are on sale locally
 * and at the provider (plus the ones an edited offer already uses), and the
 * default service (WhatsApp when it exists).
 */
export async function readyMadeFormOptions(current?: { serviceId: number; countryId: number | null }) {
  const [services, countries] = await Promise.all([
    db().service.findMany({
      where: { OR: [{ isActive: true, providerActive: true }, ...(current ? [{ id: current.serviceId }] : [])] },
      select: { id: true, name: true, providerCode: true },
      orderBy: [{ isPopular: "desc" }, { name: "asc" }],
    }),
    db().country.findMany({
      where: { OR: [{ isActive: true, providerActive: true }, ...(current?.countryId ? [{ id: current.countryId }] : [])] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const defaultService = services.find((s) => s.providerCode === DEFAULT_SERVICE_CODE) ?? services[0] ?? null;
  return {
    services: services.map((s) => ({ id: s.id, name: s.name })),
    countries,
    defaultServiceId: defaultService?.id ?? null,
    currency: platformCurrency().code,
  };
}

type Checked = { ok: false; message: string } | { ok: true; serviceId: number; countryId: number | null; price: number; isActive: boolean };

/** Server-side validation of an admin's input. Ids must exist; the price is exact (no floats). */
async function check(input: ReadyMadeOfferInput): Promise<Checked> {
  const service = await db().service.findUnique({ where: { id: input.serviceId }, select: { id: true } });
  if (!service) return { ok: false, message: "Choose an existing service." };
  if (input.countryId !== null) {
    const country = await db().country.findUnique({ where: { id: input.countryId }, select: { id: true } });
    if (!country) return { ok: false, message: "Choose an existing country, or All countries." };
  }
  const price = parseAmount(input.price.replace(",", "."));
  if (price === null || price <= 0) return { ok: false, message: "Enter a positive price like 2.50 (up to 4 decimals)." };
  if (price > MAX_PRICE_UNITS * 10_000) return { ok: false, message: `The price can be at most ${MAX_PRICE_UNITS.toLocaleString("en-US")}.` };
  return { ok: true, serviceId: input.serviceId, countryId: input.countryId, price, isActive: input.isActive };
}

const DUPLICATE: AdminResult = { ok: false, message: "This service already has a Ready Made offer for that country. Edit the existing offer instead." };

async function exists(serviceId: number, countryId: number | null, exceptId?: number) {
  const hit = await db().readyMadeOffer.findUnique({
    where: { serviceId_countryKey: { serviceId, countryKey: countryId ?? 0 } },
    select: { id: true },
  });
  return Boolean(hit && hit.id !== exceptId);
}

export async function createReadyMadeOffer(actor: AdminActor, input: ReadyMadeOfferInput): Promise<AdminResult> {
  const c = await check(input);
  if (!c.ok) return c;
  if (await exists(c.serviceId, c.countryId)) return DUPLICATE;
  try {
    const offer = await db().readyMadeOffer.create({
      data: {
        serviceId: c.serviceId,
        countryId: c.countryId,
        countryKey: c.countryId ?? 0,
        price: toDecimalString(c.price),
        currency: platformCurrency().code,
        isActive: c.isActive,
      },
      include: offerInclude,
    });
    await audit(
      actor,
      "ready_made.offer_created",
      { type: "ready_made_offer", id: String(offer.id) },
      true,
      { service: offer.service.name, country: offer.country?.name ?? "All", price: toDecimalString(c.price), currency: offer.currency, isActive: offer.isActive },
      `Created Ready Made offer ${label(offer)}`,
    );
    return { ok: true, message: `Ready Made offer created: ${label(offer)}.` };
  } catch (error) {
    // Two admins creating the same offer at once: the unique index decides.
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }
}

export async function updateReadyMadeOffer(actor: AdminActor, id: number, input: ReadyMadeOfferInput): Promise<AdminResult> {
  const before = await db().readyMadeOffer.findUnique({ where: { id }, include: offerInclude });
  if (!before) return { ok: false, message: "Offer not found." };
  const c = await check(input);
  if (!c.ok) return c;
  if (await exists(c.serviceId, c.countryId, id)) return DUPLICATE;
  let after;
  try {
    after = await db().readyMadeOffer.update({
      where: { id },
      data: {
        serviceId: c.serviceId,
        countryId: c.countryId,
        countryKey: c.countryId ?? 0,
        price: toDecimalString(c.price),
        currency: platformCurrency().code,
        isActive: c.isActive,
      },
      include: offerInclude,
    });
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (before.service.id !== after.service.id) changes.service = { from: before.service.name, to: after.service.name };
  if ((before.country?.id ?? null) !== (after.country?.id ?? null)) changes.country = { from: before.country?.name ?? "All", to: after.country?.name ?? "All" };
  if (toMinor(before.price) !== c.price) changes.price = { from: toDecimalString(toMinor(before.price)), to: toDecimalString(c.price) };
  if (before.currency !== after.currency) changes.currency = { from: before.currency, to: after.currency };
  if (before.isActive !== after.isActive) changes.isActive = { from: before.isActive, to: after.isActive };
  await audit(
    actor,
    "ready_made.offer_updated",
    { type: "ready_made_offer", id: String(id) },
    true,
    { offer: label(after), changes },
    `Updated Ready Made offer ${label(after)}`,
  );
  return { ok: true, message: Object.keys(changes).length ? `Saved: ${label(after)}.` : "Nothing changed." };
}

export async function setReadyMadeOfferActive(actor: AdminActor, id: number, isActive: boolean): Promise<AdminResult> {
  const offer = await db().readyMadeOffer.findUnique({ where: { id }, include: offerInclude });
  if (!offer) return { ok: false, message: "Offer not found." };
  if (offer.isActive === isActive) return { ok: true, message: `${label(offer)} is already ${isActive ? "enabled" : "disabled"}.` };
  await db().readyMadeOffer.update({ where: { id }, data: { isActive } });
  await audit(
    actor,
    isActive ? "ready_made.offer_enabled" : "ready_made.offer_disabled",
    { type: "ready_made_offer", id: String(id) },
    true,
    { offer: label(offer) },
    `${isActive ? "Enabled" : "Disabled"} Ready Made offer ${label(offer)}`,
  );
  return { ok: true, message: `${label(offer)} ${isActive ? "enabled" : "disabled"}.` };
}

export async function deleteReadyMadeOffer(actor: AdminActor, id: number): Promise<AdminResult> {
  const offer = await db().readyMadeOffer.findUnique({ where: { id }, include: offerInclude });
  if (!offer) return { ok: false, message: "Offer not found." };
  await db().readyMadeOffer.delete({ where: { id } });
  await audit(
    actor,
    "ready_made.offer_deleted",
    { type: "ready_made_offer", id: String(id) },
    true,
    { offer: label(offer), price: toDecimalString(toMinor(offer.price)), currency: offer.currency, wasActive: offer.isActive },
    `Deleted Ready Made offer ${label(offer)}`,
  );
  return { ok: true, message: `Deleted ${label(offer)}.` };
}

/**
 * Default configuration (seeder): WhatsApp for All countries, active, at the
 * given price — only if that offer doesn't exist yet. Never changes an
 * existing offer. Audited as a system action (no admin actor).
 */
export async function ensureDefaultReadyMadeOffer(price: string): Promise<{ status: "created" | "exists" | "no_service" | "invalid_price"; offer?: string }> {
  const service = await db().service.findFirst({ where: { providerCode: DEFAULT_SERVICE_CODE }, select: { id: true, name: true }, orderBy: { id: "asc" } });
  if (!service) return { status: "no_service" };
  const existing = await db().readyMadeOffer.findUnique({ where: { serviceId_countryKey: { serviceId: service.id, countryKey: 0 } }, include: offerInclude });
  if (existing) return { status: "exists", offer: label(existing) };
  const c = await check({ serviceId: service.id, countryId: null, price, isActive: true });
  if (!c.ok) return { status: "invalid_price" };
  try {
    const offer = await db().readyMadeOffer.create({
      data: { serviceId: service.id, countryId: null, countryKey: 0, price: toDecimalString(c.price), currency: platformCurrency().code, isActive: true },
      include: offerInclude,
    });
    await audit(
      null,
      "ready_made.offer_created",
      { type: "ready_made_offer", id: String(offer.id) },
      true,
      { service: offer.service.name, country: "All", price: toDecimalString(c.price), currency: offer.currency, isActive: true, source: "seed" },
      `Created default Ready Made offer ${label(offer)} (seed)`,
    );
    return { status: "created", offer: label(offer) };
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "exists", offer: `${service.name} · All countries` };
    throw error;
  }
}
