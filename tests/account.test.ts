import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDateRange } from "@/lib/date-range";
import { emailChangeSchema } from "@/lib/validation/auth";
import { createSession, deleteUserSession, validateSessionToken, type SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { testOutbox } from "@/server/email/mailer";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import { setProviderForTesting } from "@/server/providers/registry";
import { getAccountProfile, getOrderStats, listTransactions } from "@/server/services/account.service";
import * as auth from "@/server/services/auth.service";
import { syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { getOrderDetail, listSmsHistory, refreshOrder, requestNumber } from "@/server/services/order.service";
import { createTopUp, verifyTopUp } from "@/server/services/payment.service";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { creditWallet } from "@/server/services/wallet.service";
import { FakePaymentProvider } from "./fake-payment-provider";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

const ctx = { ip: "unknown", userAgent: "vitest" };
const PASSWORD = "Test-password-1234"; // createUser's password
const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");

async function signedIn(email?: string): Promise<{ user: SessionUser; token: string }> {
  const u = await createUser(email ? { email } : {});
  const s = await createSession(u.id, { persistent: false, ip: "127.0.0.1", userAgent: "vitest" });
  return { user: (await validateSessionToken(s.token))!, token: s.token };
}

function tokenFromEmail(to: string, path: string): string {
  const mail = [...testOutbox].reverse().find((m) => m.to === to && m.text.includes(path));
  if (!mail) throw new Error(`no ${path} email for ${to}`);
  return decodeURIComponent(mail.text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_%-]+)`))![1]);
}

let sms: FakeProvider;
let usaId: string;

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
  sms = new FakeProvider();
  setProviderForTesting(sms);
  invalidateProviderBalance();
  await syncCatalog();
  usaId = String((await db().country.findFirstOrThrow({ where: { providerCode: "12" } })).id);
});
afterEach(() => {
  setProviderForTesting(undefined);
  setPaymentProviderForTesting(undefined);
});
afterAll(() => db().$disconnect());

async function buy(userId: string) {
  const r = await requestNumber(userId, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
  if (!r.ok) throw new Error(r.message);
  return r.order;
}

describe("email change", () => {
  it("validates input", () => {
    expect(emailChangeSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ email: "new@example.com", password: "" }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ email: " New@Example.com ", password: "x" }).data?.email).toBe("new@example.com");
  });

  it("requires the current password and a different address", async () => {
    const { user } = await signedIn("old@example.com");
    expect(await auth.requestEmailChange(user, { password: "wrong-password-9", newEmail: "new@example.com" }, ctx)).toMatchObject({ ok: false, code: "wrong_password" });
    expect(await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "old@example.com" }, ctx)).toMatchObject({ ok: false, code: "same_email" });
    expect(testOutbox).toHaveLength(0);
  });

  it("changes the email only after the new inbox confirms, then logs out everywhere", async () => {
    const { user, token } = await signedIn("old@example.com");
    expect(await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "new@example.com" }, ctx)).toEqual({ ok: true });
    // Not changed yet; old address notified; pending shown.
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("old@example.com");
    expect(testOutbox.find((m) => m.to === "old@example.com")?.text).toContain("ne***@example.com");
    expect(await auth.pendingEmailChange(user.id)).toBe("new@example.com");

    const link = tokenFromEmail("new@example.com", "/confirm-email");
    expect(await auth.inspectEmailChange(link)).toEqual({ ok: true, newEmail: "new@example.com" });
    expect(await auth.confirmEmailChange(link)).toEqual({ ok: true });
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("new@example.com");
    expect(await validateSessionToken(token)).toBeNull();
    expect(await auth.confirmEmailChange(link)).toEqual({ ok: false, reason: "used" });
    expect(testOutbox.at(-1)).toMatchObject({ to: "old@example.com", subject: expect.stringMatching(/email was changed/) });
  });

  it("never reveals that an address is taken, and can't take it over", async () => {
    await createUser({ email: "taken@example.com" });
    const { user } = await signedIn("me@example.com");
    expect(await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "taken@example.com" }, ctx)).toEqual({ ok: true });
    expect(await auth.pendingEmailChange(user.id)).toBeNull();
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]).toMatchObject({ to: "taken@example.com", subject: expect.stringMatching(/tried to use your email/) });
  });

  it("fails safely if the address was taken between request and confirmation", async () => {
    const { user } = await signedIn("me@example.com");
    await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "race@example.com" }, ctx);
    const link = tokenFromEmail("race@example.com", "/confirm-email");
    await createUser({ email: "race@example.com" });
    expect(await auth.confirmEmailChange(link)).toEqual({ ok: false, reason: "taken" });
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("me@example.com");
  });

  it("a cancelled or superseded request's link stops working", async () => {
    const { user } = await signedIn("me@example.com");
    await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "first@example.com" }, ctx);
    const first = tokenFromEmail("first@example.com", "/confirm-email");
    await auth.requestEmailChange(user, { password: PASSWORD, newEmail: "second@example.com" }, ctx);
    expect(await auth.confirmEmailChange(first)).toEqual({ ok: false, reason: "used" });
    await auth.cancelEmailChange(user.id);
    expect(await auth.confirmEmailChange(tokenFromEmail("second@example.com", "/confirm-email"))).toEqual({ ok: false, reason: "used" });
    expect(await auth.inspectEmailChange("garbage-token-garbage-token")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("sessions", () => {
  it("revokes one of your own sessions, never someone else's", async () => {
    const a = await signedIn();
    const other = await createSession(a.user.id, { persistent: false, ip: null, userAgent: "phone" });
    const b = await signedIn();
    const bRow = await db().session.findFirstOrThrow({ where: { userId: b.user.id } });
    expect(await deleteUserSession(a.user.id, bRow.id)).toBe(false);
    expect(await validateSessionToken(b.token)).not.toBeNull();
    const otherRow = await db().session.findFirstOrThrow({ where: { tokenHash: { not: undefined }, userAgent: "phone" } });
    expect(await deleteUserSession(a.user.id, otherRow.id)).toBe(true);
    expect(await validateSessionToken(other.token)).toBeNull();
    expect(await validateSessionToken(a.token)).not.toBeNull();
  });
});

describe("profile and orders", () => {
  it("profile shows status and verification without secrets", async () => {
    const { user } = await signedIn();
    const p = await getAccountProfile(user);
    expect(p).toMatchObject({ status: "active", emailVerified: true, balance: 0 });
    expect(Object.keys(p)).not.toContain("passwordHash");
    expect(Object.keys(p)).not.toContain("apiKeyHash");
  });

  it("order details include SMS and ledger entries, for the owner only", async () => {
    const { user } = await signedIn();
    const other = await createUser();
    await creditWallet({ userId: user.id, amount: USD(5), type: "DEPOSIT", reference: `fund:${user.id}` });
    const order = await buy(user.id);
    const activation = (await db().order.findUniqueOrThrow({ where: { id: order.id } })).providerActivationId!;
    sms.deliver(activation, "424242");
    await refreshOrder(order.id, { force: true });

    const detail = await getOrderDetail(user.id, order.id);
    expect(detail?.order).toMatchObject({ id: order.id, status: "sms_received", code: "424242" });
    expect(detail?.order.messages).toHaveLength(1);
    expect(detail?.ledger.map((t) => t.type)).toEqual(["purchase"]);
    expect(await getOrderDetail(other.id, order.id)).toBeNull();

    const history = await listSmsHistory(user.id);
    expect(history).toMatchObject({ total: 1, items: [{ orderId: order.id, code: "424242" }] });
    expect((await listSmsHistory(other.id)).total).toBe(0);
    expect((await listSmsHistory(user.id, { q: "Telegram" })).total).toBe(1);
    expect((await listSmsHistory(user.id, { q: "WhatsApp" })).total).toBe(0);
  });

  it("ledger entries link to their order or payment", async () => {
    const { user } = await signedIn();
    await creditWallet({ userId: user.id, amount: USD(5), type: "DEPOSIT", reference: `fund:${user.id}` });
    const order = await buy(user.id);
    const items = (await listTransactions(user.id)).items;
    expect(items.find((t) => t.type === "purchase")).toMatchObject({ orderId: order.id, paymentId: null, status: "completed" });
  });
});

describe("date ranges", () => {
  const now = new Date("2026-09-28T10:00:00Z");
  it("resolves presets in UTC days", () => {
    expect(resolveDateRange({ range: "today" }, now)).toMatchObject({ fromStr: "2026-09-28", toStr: "2026-09-28" });
    expect(resolveDateRange({ range: "7d" }, now)).toMatchObject({ fromStr: "2026-09-22", toStr: "2026-09-28" });
    expect(resolveDateRange({ range: "30d" }, now)).toMatchObject({ fromStr: "2026-08-30" });
    expect(resolveDateRange({ range: "month" }, now)).toMatchObject({ fromStr: "2026-09-01" });
    expect(resolveDateRange({ range: "today" }, now).to?.toISOString()).toBe("2026-09-28T23:59:59.999Z");
  });
  it("validates custom ranges", () => {
    expect(resolveDateRange({ from: "2026-09-01", to: "2026-09-10" })).toMatchObject({ preset: "custom" });
    expect(resolveDateRange({ from: "2026-09-10", to: "2026-09-01" })).toMatchObject({ preset: "all", error: expect.any(String) });
    expect(resolveDateRange({ from: "2026-02-30" })).toMatchObject({ preset: "all", error: expect.any(String) });
    expect(resolveDateRange({ from: "'; DROP TABLE users; --" })).toMatchObject({ preset: "all", error: expect.any(String) });
    expect(resolveDateRange({ range: "forever" })).toMatchObject({ preset: "all" });
  });
});

describe("statistics", () => {
  it("are computed from the user's own records and respect the date range", async () => {
    const pay = new FakePaymentProvider();
    setPaymentProviderForTesting(pay);
    const { user } = await signedIn();
    const other = await signedIn();
    const topUp = await createTopUp(user.id, { amount: "10", method: "card", idempotencyKey: key() });
    if (!topUp.ok) throw new Error(topUp.message);
    const row = await db().payment.findUniqueOrThrow({ where: { id: topUp.payment.id } });
    pay.set(row.providerPaymentId!, { status: "paid" });
    await verifyTopUp(user.id, row.id);

    const first = await buy(user.id);
    await buy(user.id);
    // Make one order old.
    await db().order.update({ where: { id: first.id }, data: { createdAt: new Date(Date.now() - 40 * 86_400_000) } });

    const all = await getOrderStats(user.id);
    expect(all).toMatchObject({
      total: 2,
      active: 2,
      deposits: USD(10),
      spent: 2 * customerPrice(3500),
      balance: USD(10) - 2 * customerPrice(3500),
      payments: { paid: 1, paidAmount: USD(10), pending: 0, unpaid: 0 },
    });
    expect(all.byDay).toHaveLength(14);
    expect(all.byDay.at(-1)!.total).toBe(1);

    const recent = await getOrderStats(user.id, resolveDateRange({ range: "7d" }));
    expect(recent.total).toBe(1);
    const empty = await getOrderStats(other.user.id);
    expect(empty).toMatchObject({ total: 0, deposits: 0, spent: 0, smsReceived: 0, payments: { paid: 0 } });
  });
});

describe("referral and affiliate removal", () => {
  const root = join(__dirname, "..");
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  }

  it("has no referral/affiliate routes, code or schema left", () => {
    expect(existsSync(join(root, "src/app/(full)/affiliate"))).toBe(false);
    expect(existsSync(join(root, "src/app/(sidebar)/profile/referral-program"))).toBe(false);
    const sources = [...files(join(root, "src")).filter((f) => !f.includes("/generated/")), join(root, "prisma/schema.prisma"), join(root, "prisma/seed.ts")];
    const hits = sources.filter((f) => /\b(referral|referred|affiliat)/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("the database has no referral columns or earning types", async () => {
    const columns = await db().$queryRaw<{ Field: string }[]>`SHOW COLUMNS FROM users`;
    expect(columns.map((c) => c.Field).filter((f) => /\breferr/i.test(f))).toEqual([]);
    const type = await db().$queryRaw<{ Type: string }[]>`SHOW COLUMNS FROM transactions LIKE 'type'`;
    expect(type[0].Type).not.toMatch(/REFERRAL|AFFILIATE/);
  });
});
