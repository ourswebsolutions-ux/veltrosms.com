import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { ProviderError } from "@/server/providers/types";
import { getOffersForService, syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import {
  cancelOrder,
  finishOrder,
  getOrder,
  listOrders,
  refreshOrder,
  requestAnotherSms,
  requestNumber,
  sweepExpiredOrders,
} from "@/server/services/order.service";
import { applyInTx, creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakeProvider, noNumbers } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

let provider: FakeProvider;
let usaId: string;

const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
const cheapest = () => customerPrice(3500); // tg/USA cheapest provider level

async function fundedUser(amount = USD(5)) {
  const u = await createUser();
  await creditWallet({ userId: u.id, amount, type: "DEPOSIT", reference: `fund:${u.id}` });
  return u;
}

async function buy(userId: string, overrides: Partial<{ price: number; idempotencyKey: string; service: string }> = {}) {
  return requestNumber(userId, { service: "tg", country: usaId, price: cheapest(), idempotencyKey: key(), ...overrides });
}

beforeEach(async () => {
  await resetDatabase();
  provider = new FakeProvider();
  setProviderForTesting(provider);
  invalidateProviderBalance(); // don't carry a cached balance between tests
  await syncCatalog();
  usaId = String((await db().country.findFirstOrThrow({ where: { providerCode: "12" } })).id);
});
afterEach(() => setProviderForTesting(undefined));
afterAll(() => db().$disconnect());

describe("catalog sync", () => {
  it("stores countries, services and customer prices from the provider", async () => {
    expect(await db().country.count()).toBe(2);
    expect(await db().service.count()).toBe(2);
    const usa = await db().country.findFirstOrThrow({ where: { providerCode: "12" } });
    expect(usa.iso2).toBe("us");
    const offers = await getOffersForService("tg");
    expect(offers.status).toBe("ok");
    if (offers.status !== "ok") return;
    const us = offers.data.find((g) => g.country.id === usaId)!;
    expect(us.tiers.map((t) => t.price).sort((a, b) => a - b)).toEqual([customerPrice(3500), customerPrice(5000)]);
    expect(us.totalAvailable).toBe(60);
  });

  it("applies the markup and never sells below cost", () => {
    // 0.35 cost × 1.20 = 0.42; rounded up to 0.001 and ≥ cost + 0.01 margin.
    expect(customerPrice(3500)).toBe(4200);
    expect(customerPrice(1)).toBeGreaterThanOrEqual(1 + 100);
  });

  it("deactivates offers the provider stops listing", async () => {
    delete provider.tiers.wa;
    await db().setting.deleteMany(); // clear sync lock/state
    await syncCatalog();
    const wa = await db().price.findFirstOrThrow({ where: { service: { providerCode: "wa" } } });
    expect(wa.isActive).toBe(false);
  });
});

describe("purchase", () => {
  it("charges once, creates an active order and returns the number", async () => {
    const u = await fundedUser();
    const r = await buy(u.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order).toMatchObject({ status: "active", price: cheapest(), phoneNumber: expect.stringMatching(/^1555000/) });
    expect((await getBalance(u.id)).balance).toBe(USD(5) - cheapest());
    const charge = await db().transaction.findFirstOrThrow({ where: { orderId: r.order.id, type: "PURCHASE" } });
    expect(charge.reference).toBe(`order:${r.order.id}:charge`);
    expect(charge.description).toBe("Telegram · USA");
    // The provider was told the maximum cost for the chosen level.
    expect(provider.calls.find((c) => c.method === "purchaseNumber")!.args[0]).toMatchObject({ serviceCode: "tg", countryCode: "12", maxCost: 3500 });
  });

  it("a repeated submit with the same key returns the same order without charging again", async () => {
    const u = await fundedUser();
    const k = key();
    const [a, b] = await Promise.all([buy(u.id, { idempotencyKey: k }), buy(u.id, { idempotencyKey: k })]);
    expect(a.ok && b.ok && a.order.id === b.order.id).toBe(true);
    expect(await db().order.count({ where: { userId: u.id } })).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(5) - cheapest());
  });

  it("refuses when the balance is too low and creates no order", async () => {
    const u = await createUser();
    const r = await buy(u.id);
    expect(r).toMatchObject({ ok: false, code: "INSUFFICIENT_FUNDS" });
    expect(await db().order.count()).toBe(0);
  });

  it("rejects a manipulated (lower) price and reports the real ones", async () => {
    const u = await fundedUser();
    const r = await buy(u.id, { price: 1 });
    expect(r).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    if (!r.ok) expect(r.prices).toContain(cheapest());
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("refunds automatically when the provider has no numbers", async () => {
    const u = await fundedUser();
    provider.purchaseError = noNumbers();
    const r = await buy(u.id);
    expect(r).toMatchObject({ ok: false, code: "NO_NUMBERS" });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
    const order = await db().order.findFirstOrThrow({ where: { userId: u.id } });
    expect(order.status).toBe("FAILED");
    expect(await db().transaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(1);
  });

  it("refunds on provider timeouts too", async () => {
    const u = await fundedUser();
    provider.purchaseError = new ProviderError("TIMEOUT", "timeout", "fake");
    expect(await buy(u.id)).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("rejects unknown services/countries", async () => {
    const u = await fundedUser();
    expect(await buy(u.id, { service: "nope" })).toMatchObject({ ok: false, code: "INVALID" });
  });
});

describe("lifecycle", () => {
  async function active() {
    const u = await fundedUser();
    const r = await buy(u.id);
    if (!r.ok) throw new Error("purchase failed");
    const order = await db().order.findUniqueOrThrow({ where: { id: r.order.id } });
    return { user: u, orderId: r.order.id, activationId: order.providerActivationId! };
  }

  it("stores the SMS, then finishes", async () => {
    const { user, orderId, activationId } = await active();
    provider.deliver(activationId, "852508");
    const o = await getOrder(user.id, orderId);
    expect(o).toMatchObject({ status: "sms_received", code: "852508", smsText: "Your code is 852508", canFinish: true });
    // Polling again doesn't duplicate the message.
    await refreshOrder(orderId, { force: true });
    expect(await db().sms.count({ where: { orderId } })).toBe(1);

    const f = await finishOrder(user.id, orderId);
    expect(f).toMatchObject({ ok: true, order: { status: "completed" } });
    expect((await getBalance(user.id)).balance).toBe(USD(5) - cheapest());
  });

  it("cancel refunds exactly once", async () => {
    const { user, orderId } = await active();
    const [a, b] = await Promise.all([cancelOrder(user.id, orderId), cancelOrder(user.id, orderId)]);
    expect([a.ok, b.ok].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect((await getBalance(user.id)).balance).toBe(USD(5));
    expect(await db().transaction.count({ where: { orderId, type: "REFUND" } })).toBe(1);
    expect((await db().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
  });

  it("can't cancel once an SMS has arrived", async () => {
    const { user, orderId, activationId } = await active();
    provider.deliver(activationId, "111222");
    expect(await cancelOrder(user.id, orderId)).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });

  it("respects the provider's early-cancel rule", async () => {
    const { user, orderId } = await active();
    provider.cancelError = new ProviderError("EARLY_CANCEL", "EARLY_CANCEL_DENIED", "fake");
    expect(await cancelOrder(user.id, orderId)).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
    expect((await getBalance(user.id)).balance).toBe(USD(5) - cheapest());
  });

  it("requests another code on the same number", async () => {
    const { user, orderId, activationId } = await active();
    provider.deliver(activationId, "123456");
    await getOrder(user.id, orderId);
    const r = await requestAnotherSms(user.id, orderId);
    expect(r).toMatchObject({ ok: true, order: { status: "active" } });
  });

  it("expired orders without SMS are refunded by the sweep", async () => {
    const { user, orderId } = await active();
    await db().order.update({ where: { id: orderId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await sweepExpiredOrders()).toBe(1);
    expect((await db().order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("EXPIRED");
    expect((await getBalance(user.id)).balance).toBe(USD(5));
  });

  it("provider-side cancellation refunds; unknown status is rejected safely", async () => {
    const { user, orderId, activationId } = await active();
    provider.states.set(activationId, { state: "cancelled" });
    const o = await getOrder(user.id, orderId);
    expect(o?.status).toBe("cancelled");
    expect((await getBalance(user.id)).balance).toBe(USD(5));
    // Finishing a cancelled order is not allowed.
    expect(await finishOrder(user.id, orderId)).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });
});

describe("authorization", () => {
  it("users can't see or act on each other's orders", async () => {
    const owner = await fundedUser();
    const other = await fundedUser();
    const r = await buy(owner.id);
    if (!r.ok) throw new Error("purchase failed");
    expect(await getOrder(other.id, r.order.id)).toBeNull();
    expect(await cancelOrder(other.id, r.order.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect((await listOrders(other.id)).total).toBe(0);
    expect((await getBalance(owner.id)).balance).toBe(USD(5) - cheapest());
  });
});

describe("phase 5: provider safety", () => {
  it("never charges when the provider account can't pay (pre-flight check)", async () => {
    const u = await fundedUser();
    provider.balance = 0;
    const r = await buy(u.id);
    expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await db().order.count()).toBe(0);
    expect(await db().transaction.count({ where: { userId: u.id, type: { not: "DEPOSIT" } } })).toBe(0);
    expect(provider.calls.some((c) => c.method === "purchaseNumber")).toBe(false);
  });

  it("adopts a number the provider issued despite a timeout (no refund, no double purchase)", async () => {
    const u = await fundedUser();
    provider.purchaseError = new ProviderError("TIMEOUT", "timeout", "fake");
    provider.issueDespiteError = true;
    const r = await buy(u.id);
    expect(r).toMatchObject({ ok: true, order: { status: "active" } });
    expect(await db().transaction.count({ where: { userId: u.id, type: "REFUND" } })).toBe(0);
    expect(provider.calls.filter((c) => c.method === "purchaseNumber")).toHaveLength(1);
  });

  it("refunds after a timeout when the provider confirms nothing was issued", async () => {
    const u = await fundedUser();
    provider.purchaseError = new ProviderError("TIMEOUT", "timeout", "fake");
    expect(await buy(u.id)).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("does not refund on a failed cancel unless the provider confirms the closure", async () => {
    const u = await fundedUser();
    const r = await buy(u.id);
    if (!r.ok) throw new Error("purchase failed");
    provider.cancelError = new ProviderError("UNAVAILABLE", "down", "fake");
    expect(await cancelOrder(u.id, r.order.id)).toMatchObject({ ok: false, code: "PROVIDER_ERROR" });
    expect((await getBalance(u.id)).balance).toBe(USD(5) - cheapest());
    expect(await db().transaction.count({ where: { orderId: r.order.id, type: "REFUND" } })).toBe(0);
  });

  it("treats a sold-out live inventory as unavailable, not as stale stock", async () => {
    const u = await fundedUser();
    delete provider.tiers.tg["12"];
    expect(await buy(u.id)).toMatchObject({ ok: false, code: "INVALID" });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("falls back to synced prices when live inventory is unavailable", async () => {
    provider.inventoryError = new ProviderError("UNAVAILABLE", "down", "fake");
    const offers = await getOffersForService("wa");
    expect(offers.status).toBe("ok");
    if (offers.status === "ok") expect(offers.data[0].minPrice).toBe(customerPrice(12000));
  });

  it("hides countries the provider marks invisible, keeping the admin switch untouched", async () => {
    provider.countries[1].visible = false;
    await db().setting.deleteMany();
    await syncCatalog();
    const uk = await db().country.findFirstOrThrow({ where: { providerCode: "16" } });
    expect(uk).toMatchObject({ providerActive: false, isActive: true });
  });

  it("marks services the provider stops listing as unavailable", async () => {
    provider.services = provider.services.filter((s) => s.providerCode !== "wa");
    await db().setting.deleteMany();
    await syncCatalog();
    expect((await db().service.findFirstOrThrow({ where: { providerCode: "wa" } })).providerActive).toBe(false);
  });
});

describe("phase 6: purchase flow safety", () => {
  /** An order charged but interrupted before the provider answered (server restart). */
  async function interruptedOrder(userId: string, ageMs = 3 * 60_000) {
    const [service, country] = await Promise.all([
      db().service.findFirstOrThrow({ where: { providerCode: "tg" } }),
      db().country.findFirstOrThrow({ where: { providerCode: "12" } }),
    ]);
    return db().$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          serviceId: service.id,
          countryId: country.id,
          provider: "fake",
          status: "PENDING",
          price: "0.0420",
          currency: "USD",
          providerCost: "0.0350",
          idempotencyKey: key(),
          createdAt: new Date(Date.now() - ageMs),
        },
      });
      await applyInTx(tx, { userId, amount: 420, type: "PURCHASE", reference: `order:${order.id}:charge`, orderId: order.id }, -1);
      return order;
    });
  }

  it("a resubmit after a failed purchase reports the failure again, never a success", async () => {
    const u = await fundedUser();
    provider.purchaseError = noNumbers();
    const k = key();
    expect(await buy(u.id, { idempotencyKey: k })).toMatchObject({ ok: false, code: "NO_NUMBERS" });
    provider.purchaseError = null;
    expect(await buy(u.id, { idempotencyKey: k })).toMatchObject({ ok: false, code: "NO_NUMBERS" });
    expect(provider.calls.filter((c) => c.method === "purchaseNumber")).toHaveLength(1);
    expect((await getBalance(u.id)).balance).toBe(USD(5));
    // A new attempt (new key) can buy normally.
    expect(await buy(u.id)).toMatchObject({ ok: true, order: { status: "active" } });
    expect((await getBalance(u.id)).balance).toBe(USD(5) - cheapest());
  });

  it("recovers an interrupted purchase by adopting the number the provider issued", async () => {
    const u = await fundedUser();
    const order = await interruptedOrder(u.id);
    const issued = await provider.purchaseNumber({ serviceCode: "tg", countryCode: "12" });
    await refreshOrder(order.id);
    const row = await db().order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ status: "ACTIVE", providerActivationId: issued.activationId });
    expect(await db().transaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(0);
  });

  it("refunds an interrupted purchase exactly once when the provider issued nothing", async () => {
    const u = await fundedUser();
    const order = await interruptedOrder(u.id);
    await Promise.all([refreshOrder(order.id), refreshOrder(order.id), sweepExpiredOrders()]);
    expect((await db().order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");
    expect(await db().transaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("leaves a recent pending purchase alone (it may still be in flight)", async () => {
    const u = await fundedUser();
    const order = await interruptedOrder(u.id, 10_000);
    await refreshOrder(order.id);
    expect((await db().order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });

  it("a late provider answer can't revive an order that was already refunded", async () => {
    const u = await fundedUser();
    provider.onPurchase = async (ctx) => {
      // Meanwhile the order is treated as interrupted and refunded.
      await db().order.update({ where: { id: ctx!.orderId! }, data: { createdAt: new Date(Date.now() - 3 * 60_000) } });
      await refreshOrder(ctx!.orderId!);
    };
    const r = await buy(u.id);
    expect(r.ok).toBe(false);
    const order = await db().order.findFirstOrThrow({ where: { userId: u.id } });
    expect(order.status).toBe("FAILED");
    expect(await db().transaction.count({ where: { orderId: order.id, type: "REFUND" } })).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(5));
    // The number we were given is released at the provider.
    expect(provider.calls.some((c) => c.method === "changeStatus" && c.args[1] === "cancel")).toBe(true);
  });

  it("concurrent cancels refund once", async () => {
    const u = await fundedUser();
    const r = await buy(u.id);
    if (!r.ok) throw new Error("purchase failed");
    await Promise.all([cancelOrder(u.id, r.order.id), cancelOrder(u.id, r.order.id), cancelOrder(u.id, r.order.id)]);
    expect(await db().transaction.count({ where: { orderId: r.order.id, type: "REFUND" } })).toBe(1);
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("rejects a higher-than-listed price too (only exact current prices are accepted)", async () => {
    const u = await fundedUser();
    expect(await buy(u.id, { price: cheapest() + 1 })).toMatchObject({ ok: false, code: "PRICE_CHANGED" });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("returns every received SMS, oldest first", async () => {
    const u = await fundedUser();
    const r = await buy(u.id);
    if (!r.ok) throw new Error("purchase failed");
    const id = r.order.id;
    const activation = (await db().order.findUniqueOrThrow({ where: { id } })).providerActivationId!;
    provider.deliver(activation, "111111");
    await refreshOrder(id, { force: true });
    await requestAnotherSms(u.id, id);
    provider.deliver(activation, "222222", "Second code 222222");
    await refreshOrder(id, { force: true });
    const latest = (await getOrder(u.id, id))!;
    expect(latest.messages.map((m) => m.code)).toEqual(["111111", "222222"]);
    expect(latest).toMatchObject({ code: "222222", smsCount: 2, status: "sms_received" });
  });

  it("finds orders by the order ID shown to the customer", async () => {
    const u = await fundedUser();
    const r = await buy(u.id);
    if (!r.ok) throw new Error("purchase failed");
    await buy(u.id);
    const found = await listOrders(u.id, { q: `#${r.order.id.slice(0, 8)}` });
    expect(found.items.map((o) => o.id)).toEqual([r.order.id]);
  });
});
