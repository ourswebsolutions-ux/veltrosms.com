import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import {
  createReadyMadeOffer,
  deleteReadyMadeOffer,
  ensureDefaultReadyMadeOffer,
  listReadyMadeOffers,
  readyMadeFormOptions,
  setReadyMadeOfferActive,
  updateReadyMadeOffer,
} from "@/server/admin/ready-made";
import { db } from "@/server/db";
import { createUser, resetDatabase, USD } from "./helpers";

async function admin(): Promise<AdminActor> {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  return { id: u.id, email: u.email, name: u.name, sessionId: "test" };
}

async function catalog() {
  const svc = (code: string, name: string, extra: { isActive?: boolean } = {}) =>
    db().service.create({ data: { provider: "grizzly", providerCode: code, slug: code, name, ...extra } });
  const whatsapp = await svc("wa", "Whatsapp");
  const telegram = await svc("tg", "Telegram");
  const hidden = await svc("zz", "Hidden", { isActive: false });
  const pakistan = await db().country.create({ data: { provider: "grizzly", providerCode: "66", name: "Pakistan", iso2: "pk" } });
  return { whatsapp, telegram, hidden, pakistan };
}

const auditCount = (action: string) => db().auditLog.count({ where: { action } });

beforeEach(() => resetDatabase());
afterAll(() => db().$disconnect());

describe("Ready Made offers — admin configuration", () => {
  it("defaults the form to WhatsApp and lists only services on sale", async () => {
    const c = await catalog();
    const o = await readyMadeFormOptions();
    expect(o.defaultServiceId).toBe(c.whatsapp.id);
    expect(o.services.map((s) => s.name)).toEqual(["Telegram", "Whatsapp"]);
    expect(o.countries.map((x) => x.name)).toEqual(["Pakistan"]);
    expect(o.currency).toBe("USD");
  });

  it("creates All-countries and per-country offers with an admin price, audited", async () => {
    const a = await admin();
    const c = await catalog();
    expect(await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: null, price: "2.50", availableQuantity: "100", isActive: true })).toMatchObject({ ok: true });
    expect(await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: c.pakistan.id, price: "3", availableQuantity: "100", isActive: false })).toMatchObject({ ok: true });
    const rows = await listReadyMadeOffers();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ country: null, price: USD(2.5), currency: "USD", isActive: true });
    expect(rows[1]).toMatchObject({ country: { name: "Pakistan" }, price: USD(3), isActive: false });
    expect(await auditCount("ready_made.offer_created")).toBe(2);
  });

  it("prevents duplicate service/country offers, including All countries", async () => {
    const a = await admin();
    const c = await catalog();
    await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: null, price: "1", availableQuantity: "100", isActive: true });
    await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: c.pakistan.id, price: "1", availableQuantity: "100", isActive: true });
    expect(await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: null, price: "5", availableQuantity: "100", isActive: true })).toMatchObject({ ok: false });
    expect(await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: c.pakistan.id, price: "5", availableQuantity: "100", isActive: true })).toMatchObject({ ok: false });
    // The same country for another service is fine.
    expect(await createReadyMadeOffer(a, { serviceId: c.telegram.id, countryId: null, price: "1", availableQuantity: "100", isActive: true })).toMatchObject({ ok: true });
    // Concurrent creates: the unique index lets exactly one through.
    const results = await Promise.all(
      Array.from({ length: 4 }, () => createReadyMadeOffer(a, { serviceId: c.telegram.id, countryId: c.pakistan.id, price: "1", availableQuantity: "100", isActive: true })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db().readyMadeOffer.count()).toBe(4);
  });

  it("validates input on the server", async () => {
    const a = await admin();
    const c = await catalog();
    const base = { serviceId: c.whatsapp.id, countryId: null, availableQuantity: "100", isActive: true };
    for (const price of ["0", "-1", "abc", "", "1.23456", "100001"]) {
      expect(await createReadyMadeOffer(a, { ...base, price })).toMatchObject({ ok: false });
    }
    expect(await createReadyMadeOffer(a, { ...base, serviceId: 999_999, price: "1" })).toMatchObject({ ok: false });
    expect(await createReadyMadeOffer(a, { ...base, countryId: 999_999, price: "1" })).toMatchObject({ ok: false });
    expect(await db().readyMadeOffer.count()).toBe(0);
    expect(await createReadyMadeOffer(a, { ...base, price: "0.035" })).toMatchObject({ ok: true });
  });

  it("edits, enables/disables and deletes offers, each audited", async () => {
    const a = await admin();
    const c = await catalog();
    await createReadyMadeOffer(a, { serviceId: c.whatsapp.id, countryId: null, price: "1", availableQuantity: "100", isActive: true });
    await createReadyMadeOffer(a, { serviceId: c.telegram.id, countryId: null, price: "1", availableQuantity: "100", isActive: true });
    const [wa, tg] = await db().readyMadeOffer.findMany({ orderBy: { id: "asc" } });

    expect(await updateReadyMadeOffer(a, wa.id, { serviceId: c.whatsapp.id, countryId: c.pakistan.id, price: "4.20", availableQuantity: "100", isActive: true })).toMatchObject({ ok: true });
    const updated = await db().readyMadeOffer.findUniqueOrThrow({ where: { id: wa.id } });
    expect(updated).toMatchObject({ countryId: c.pakistan.id, countryKey: c.pakistan.id });
    expect(updated.price.toString()).toBe("4.2");
    // Moving Telegram onto an existing (service, country) pair is refused.
    await createReadyMadeOffer(a, { serviceId: c.telegram.id, countryId: c.pakistan.id, price: "1", availableQuantity: "100", isActive: true });
    expect(await updateReadyMadeOffer(a, tg.id, { serviceId: c.telegram.id, countryId: c.pakistan.id, price: "1", availableQuantity: "100", isActive: true })).toMatchObject({ ok: false });
    expect(await updateReadyMadeOffer(a, 999_999, { serviceId: c.telegram.id, countryId: null, price: "1", availableQuantity: "100", isActive: true })).toMatchObject({ ok: false });

    expect(await setReadyMadeOfferActive(a, wa.id, false)).toMatchObject({ ok: true });
    expect((await db().readyMadeOffer.findUniqueOrThrow({ where: { id: wa.id } })).isActive).toBe(false);
    expect(await setReadyMadeOfferActive(a, wa.id, true)).toMatchObject({ ok: true });
    expect(await deleteReadyMadeOffer(a, tg.id)).toMatchObject({ ok: true });
    expect(await deleteReadyMadeOffer(a, tg.id)).toMatchObject({ ok: false });

    expect(await auditCount("ready_made.offer_updated")).toBe(1);
    expect(await auditCount("ready_made.offer_disabled")).toBe(1);
    expect(await auditCount("ready_made.offer_enabled")).toBe(1);
    expect(await auditCount("ready_made.offer_deleted")).toBe(1);
    const log = await db().auditLog.findFirstOrThrow({ where: { action: "ready_made.offer_updated" } });
    expect(log).toMatchObject({ actorId: a.id, targetType: "ready_made_offer", targetId: String(wa.id) });
  });

  it("database guards: derived country key, positive price, provider rows protected", async () => {
    const c = await catalog();
    // A wrong key from a client is corrected by the trigger, so duplicates can't slip through.
    const o = await db().readyMadeOffer.create({ data: { serviceId: c.whatsapp.id, countryId: c.pakistan.id, countryKey: 0, price: "1", currency: "USD" } });
    expect(o.countryKey).toBe(c.pakistan.id);
    await expect(db().readyMadeOffer.create({ data: { serviceId: c.whatsapp.id, countryId: c.pakistan.id, countryKey: 0, price: "1", currency: "USD" } })).rejects.toThrow();
    await expect(db().readyMadeOffer.create({ data: { serviceId: c.telegram.id, countryId: null, price: "0", currency: "USD" } })).rejects.toThrow();
    // Referenced services/countries can't be deleted out from under an offer.
    await expect(db().country.delete({ where: { id: c.pakistan.id } })).rejects.toThrow();
  });

  it("seeds the default WhatsApp / All countries offer once, never overwriting", async () => {
    await catalog();
    expect(await ensureDefaultReadyMadeOffer("abc")).toMatchObject({ status: "invalid_price" });
    expect(await ensureDefaultReadyMadeOffer("2.50")).toMatchObject({ status: "created", offer: "Whatsapp · All countries" });
    expect(await ensureDefaultReadyMadeOffer("9.99")).toMatchObject({ status: "exists" });
    const all = await db().readyMadeOffer.findMany();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ countryId: null, isActive: true });
    expect(all[0].price.toString()).toBe("2.5");
    expect(await auditCount("ready_made.offer_created")).toBe(1);
  });

  it("reports when WhatsApp isn't in the catalog yet", async () => {
    expect(await ensureDefaultReadyMadeOffer("2.50")).toMatchObject({ status: "no_service" });
  });
});
