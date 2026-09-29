import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOrderById, getOrders, getWallet, getWalletTransactions, postOrder } from "@/server/api/handlers";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { createApiKey, revokeApiKey } from "@/server/services/api-key.service";
import { syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function call(handler: unknown, opts: { key?: string; method?: string; body?: unknown; url?: string; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const req = new NextRequest(opts.url ?? "http://localhost:3000/api/test", {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}),
      ...(opts.body ? { "content-type": "application/json" } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

let usaId: string;

beforeEach(async () => {
  await resetDatabase();
  setProviderForTesting(new FakeProvider());
  invalidateProviderBalance();
  await syncCatalog();
  usaId = String((await db().country.findFirstOrThrow({ where: { providerCode: "12" } })).id);
});
afterEach(() => setProviderForTesting(undefined));
afterAll(() => db().$disconnect());

describe("API authentication", () => {
  it("rejects requests without credentials", async () => {
    expect((await call(getWallet)).status).toBe(401);
  });

  it("rejects invalid and revoked keys", async () => {
    const u = await createUser();
    expect((await call(getWallet, { key: "rk_live_not-a-real-key" })).status).toBe(401);
    const { key } = await createApiKey(u.id);
    expect((await call(getWallet, { key })).status).toBe(200);
    await revokeApiKey(u.id);
    expect((await call(getWallet, { key })).status).toBe(401);
  });

  it("stores only a hash of the key", async () => {
    const u = await createUser();
    const { key } = await createApiKey(u.id);
    const row = await db().user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.apiKeyHash).not.toContain(key);
    expect(row.apiKeyHint).toMatch(/^rk_live_…/);
  });
});

describe("wallet and orders over the API", () => {
  it("returns the caller's own balance and history", async () => {
    const u = await createUser();
    const { key } = await createApiKey(u.id);
    await creditWallet({ userId: u.id, amount: USD(3), type: "DEPOSIT", reference: "api:dep" });
    expect((await call(getWallet, { key })).body).toMatchObject({ balance: USD(3), currency: "USD" });
    const tx = await call(getWalletTransactions, { key, url: "http://localhost:3000/api/wallet/transactions?type=deposit&pageSize=5" });
    expect(tx.body).toMatchObject({ total: 1, pageSize: 5 });
  });

  it("ignores a user id in the body and charges only the key's owner", async () => {
    const buyer = await createUser();
    const victim = await createUser();
    await creditWallet({ userId: buyer.id, amount: USD(5), type: "DEPOSIT", reference: "api:b" });
    await creditWallet({ userId: victim.id, amount: USD(5), type: "DEPOSIT", reference: "api:v" });
    const { key } = await createApiKey(buyer.id);
    const res = await call(postOrder, {
      key,
      method: "POST",
      body: { service: "tg", country: usaId, price: customerPrice(3500), userId: victim.id },
      headers: { "idempotency-key": "api-test-key-000000001" },
    });
    expect(res.status).toBe(201);
    expect((await getBalance(victim.id)).balance).toBe(USD(5));
    expect((await getBalance(buyer.id)).balance).toBe(USD(5) - customerPrice(3500));
  });

  it("rejects a manipulated price", async () => {
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(5), type: "DEPOSIT", reference: "api:m" });
    const { key } = await createApiKey(u.id);
    const res = await call(postOrder, {
      key,
      method: "POST",
      body: { service: "tg", country: usaId, price: 1 },
      headers: { "idempotency-key": "api-test-key-000000002" },
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: "PRICE_CHANGED" } });
    expect((await getBalance(u.id)).balance).toBe(USD(5));
  });

  it("requires an idempotency key and validates the body", async () => {
    const u = await createUser();
    const { key } = await createApiKey(u.id);
    expect((await call(postOrder, { key, method: "POST", body: { service: "tg", country: usaId, price: 4200 } })).status).toBe(400);
    expect((await call(postOrder, { key, method: "POST", body: { service: "tg", country: usaId, price: -5 }, headers: { "idempotency-key": "api-test-key-000000003" } })).status).toBe(400);
  });

  it("hides other users' orders", async () => {
    const owner = await createUser();
    const other = await createUser();
    await creditWallet({ userId: owner.id, amount: USD(5), type: "DEPOSIT", reference: "api:o" });
    const ownerKey = (await createApiKey(owner.id)).key;
    const otherKey = (await createApiKey(other.id)).key;
    const created = await call(postOrder, {
      key: ownerKey,
      method: "POST",
      body: { service: "tg", country: usaId, price: customerPrice(3500) },
      headers: { "idempotency-key": "api-test-key-000000004" },
    });
    const id = (created.body.order as { id: string }).id;
    expect((await call(getOrderById, { key: otherKey, params: { id } })).status).toBe(404);
    expect((await call(getOrders, { key: otherKey })).body).toMatchObject({ total: 0 });
    expect((await call(getOrderById, { key: ownerKey, params: { id } })).status).toBe(200);
  });
});
