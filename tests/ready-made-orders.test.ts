import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import { createReadyMadeOffer, deleteReadyMadeOffer, setReadyMadeOfferActive, updateReadyMadeOffer } from "@/server/admin/ready-made";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import type { SmsProvider } from "@/server/providers/types";
import { readyMadeWhatsappHref } from "@/lib/whatsapp";
import { sweepExpiredOrders } from "@/server/services/order.service";
import {
  getReadyMadeOrder,
  listReadyMadeOffers,
  listReadyMadeOrders,
  purchaseReadyMade,
  readyMadeContact,
} from "@/server/services/ready-made.service";
import { clearSettingsCache, saveSetting } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

/** Records every provider method call; Ready Made must never make one. */
let providerCalls: string[] = [];
function recordingProvider(): SmsProvider {
  const inner = new FakeProvider();
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        providerCalls.push(String(prop));
        return value.apply(target, args);
      };
    },
  }) as unknown as SmsProvider;
}

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");

async function admin(): Promise<AdminActor> {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  return { id: u.id, email: u.email, name: u.name, sessionId: "test" };
}

async function setup() {
  const a = await admin();
  const whatsapp = await db().service.create({ data: { provider: "fake", providerCode: "wa", slug: "wa", name: "Whatsapp" } });
  const telegram = await db().service.create({ data: { provider: "fake", providerCode: "tg", slug: "tg", name: "Telegram" } });
  const pk = await db().country.create({ data: { provider: "fake", providerCode: "66", name: "Pakistan", iso2: "pk" } });
  await createReadyMadeOffer(a, { serviceId: whatsapp.id, countryId: null, price: "2.50", isActive: true });
  await createReadyMadeOffer(a, { serviceId: whatsapp.id, countryId: pk.id, price: "3", isActive: true });
  await createReadyMadeOffer(a, { serviceId: telegram.id, countryId: null, price: "1", isActive: false });
  const offers = await db().readyMadeOffer.findMany({ orderBy: { id: "asc" } });
  return { a, whatsapp, telegram, pk, waAll: offers[0], waPk: offers[1], tgAll: offers[2] };
}

async function buyer(balance: number) {
  const u = await createUser();
  if (balance > 0) await creditWallet({ userId: u.id, amount: USD(balance), type: "DEPOSIT", reference: `test:${u.id}:fund` });
  return u;
}

const buy = (userId: string, offerId: number, price: number, idempotencyKey = key()) => purchaseReadyMade(userId, { offerId, price, idempotencyKey });

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  providerCalls = [];
  setProviderForTesting(recordingProvider());
});
afterEach(() => {
  setProviderForTesting(undefined);
  clearSettingsCache();
});
afterAll(() => db().$disconnect());

describe("Ready Made Accounts — customer side", () => {
  it("lists only active offers for services that are switched on", async () => {
    const s = await setup();
    let list = await listReadyMadeOffers();
    expect(list.map((o) => [o.service.name, o.country?.name ?? "All", o.price])).toEqual([
      ["Whatsapp", "All", USD(2.5)],
      ["Whatsapp", "Pakistan", USD(3)],
    ]);
    await db().service.update({ where: { id: s.whatsapp.id }, data: { isActive: false } });
    list = await listReadyMadeOffers();
    expect(list).toEqual([]);
  });

  it("charges the offer price exactly once, records the order and ledger, and never calls the provider", async () => {
    const s = await setup();
    const u = await buyer(10);
    const r = await buy(u.id, s.waAll.id, USD(2.5));
    expect(r).toMatchObject({ ok: true, reference: expect.stringMatching(/^RM-[2-9A-HJKMNP-Z]{8}$/) });
    if (!r.ok) return;
    expect((await getBalance(u.id)).balance).toBe(USD(7.5));
    const order = await db().readyMadeOrder.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(order).toMatchObject({ userId: u.id, offerId: s.waAll.id, serviceName: "Whatsapp", countryName: null, currency: "USD", status: "AWAITING_DELIVERY" });
    expect(order.price.toString()).toBe("2.5");
    const ledger = await db().transaction.findMany({ where: { userId: u.id, type: "PURCHASE" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ reference: `ready_made:${r.orderId}:charge`, orderId: null, paymentId: null });
    expect(ledger[0].amount.toString()).toBe("-2.5");
    expect(ledger[0].description).toContain(r.reference);
    // Nothing in the provider order lifecycle.
    expect(await db().order.count()).toBe(0);
    expect(providerCalls).toEqual([]);
  });

  it("rejects insufficient balance without creating anything", async () => {
    const s = await setup();
    const u = await buyer(1);
    expect(await buy(u.id, s.waAll.id, USD(2.5))).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" });
    const none = await buyer(0);
    expect(await buy(none.id, s.waAll.id, USD(2.5))).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" });
    expect((await getBalance(u.id)).balance).toBe(USD(1));
    expect(await db().readyMadeOrder.count()).toBe(0);
    expect(await db().transaction.count({ where: { type: "PURCHASE" } })).toBe(0);
  });

  it("never trusts the browser's price: a changed price is reported, not charged", async () => {
    const s = await setup();
    const u = await buyer(10);
    expect(await buy(u.id, s.waAll.id, USD(0.01))).toMatchObject({ ok: false, code: "PRICE_CHANGED", price: USD(2.5) });
    await updateReadyMadeOffer(s.a, s.waAll.id, { serviceId: s.whatsapp.id, countryId: null, price: "4", isActive: true });
    expect(await buy(u.id, s.waAll.id, USD(2.5))).toMatchObject({ ok: false, code: "PRICE_CHANGED", price: USD(4) });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
    expect(await buy(u.id, s.waAll.id, USD(4))).toMatchObject({ ok: true });
    expect((await getBalance(u.id)).balance).toBe(USD(6));
  });

  it("refuses disabled, deleted, unknown and maintenance-time purchases", async () => {
    const s = await setup();
    const u = await buyer(10);
    expect(await buy(u.id, s.tgAll.id, USD(1))).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    await setReadyMadeOfferActive(s.a, s.waPk.id, false);
    expect(await buy(u.id, s.waPk.id, USD(3))).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    await deleteReadyMadeOffer(s.a, s.waPk.id);
    expect(await buy(u.id, s.waPk.id, USD(3))).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await buy(u.id, 999_999, USD(3))).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    await saveSetting("maintenance", { enabled: true, message: "" });
    clearSettingsCache();
    expect(await buy(u.id, s.waAll.id, USD(2.5))).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect((await getBalance(u.id)).balance).toBe(USD(10));
    expect(await db().readyMadeOrder.count()).toBe(0);
  });

  it("is idempotent: double clicks and retries with the same key charge once", async () => {
    const s = await setup();
    const u = await buyer(10);
    const k = key();
    const results = await Promise.all(Array.from({ length: 5 }, () => buy(u.id, s.waAll.id, USD(2.5), k)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.orderId : ""))).size).toBe(1);
    const again = await buy(u.id, s.waAll.id, USD(2.5), k);
    expect(again).toEqual(results[0]);
    expect(await db().readyMadeOrder.count()).toBe(1);
    expect(await db().transaction.count({ where: { type: "PURCHASE" } })).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(7.5));
  });

  it("concurrent different purchases never overdraw the wallet", async () => {
    const s = await setup();
    const u = await buyer(5);
    const results = await Promise.all(Array.from({ length: 4 }, () => buy(u.id, s.waAll.id, USD(2.5))));
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok && r.code === "INSUFFICIENT_FUNDS")).toHaveLength(2);
    expect((await getBalance(u.id)).balance).toBe(0);
    expect(await db().readyMadeOrder.count()).toBe(2);
  });

  it("is invisible to the provider order sweep", async () => {
    const s = await setup();
    const u = await buyer(10);
    const r = await buy(u.id, s.waAll.id, USD(2.5));
    // Even long after the purchase, the sweep finds nothing and calls nobody.
    await db().$executeRawUnsafe("UPDATE ready_made_orders SET created_at = '2000-01-01 00:00:00'");
    expect(await sweepExpiredOrders()).toBe(0);
    expect(providerCalls).toEqual([]);
    expect(r.ok && (await db().readyMadeOrder.findUnique({ where: { id: r.orderId } }))?.status).toBe("AWAITING_DELIVERY");
    expect((await getBalance(u.id)).balance).toBe(USD(7.5));
  });

  it("shows an order only to its buyer, and keeps it when the offer is deleted", async () => {
    const s = await setup();
    const u = await buyer(10);
    const other = await buyer(0);
    const r = await buy(u.id, s.waPk.id, USD(3));
    if (!r.ok) throw new Error("purchase failed");
    expect(await getReadyMadeOrder(u.id, r.orderId)).toMatchObject({ reference: r.reference, country: { name: "Pakistan", iso2: "pk" }, price: USD(3) });
    expect(await getReadyMadeOrder(other.id, r.orderId)).toBeNull();
    expect(await listReadyMadeOrders(other.id)).toEqual([]);
    await deleteReadyMadeOffer(s.a, s.waPk.id);
    const kept = await db().readyMadeOrder.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(kept).toMatchObject({ offerId: null, serviceName: "Whatsapp", countryName: "Pakistan" });
  });

  it("database guards: paid orders can't be altered or deleted", async () => {
    const s = await setup();
    const u = await buyer(10);
    const r = await buy(u.id, s.waAll.id, USD(2.5));
    if (!r.ok) throw new Error("purchase failed");
    await expect(db().readyMadeOrder.update({ where: { id: r.orderId }, data: { price: "0.01" } })).rejects.toThrow();
    await expect(db().readyMadeOrder.delete({ where: { id: r.orderId } })).rejects.toThrow();
  });

  it("WhatsApp contact defaults to 03246623395 and carries the order reference", async () => {
    const c = await readyMadeContact();
    expect(c).toEqual({ whatsapp: "03246623395", whatsappDigits: "923246623395" });
    const href = readyMadeWhatsappHref(c.whatsappDigits, { reference: "RM-ABCDEFGH", service: "Whatsapp", country: null, email: "a@b.test" });
    expect(href.startsWith("https://wa.me/923246623395?text=")).toBe(true);
    const text = decodeURIComponent(href.split("text=")[1]);
    expect(text).toContain("Order: RM-ABCDEFGH");
    expect(text).toContain("Country: All countries");
  });
});
