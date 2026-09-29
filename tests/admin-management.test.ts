import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdminActor } from "@/server/admin/guard";
import { getDashboard, listAuditLogs, listLedger, listWallets } from "@/server/admin/platform";
import { ensureAdmin } from "@/server/admin/setup";
import { approveTopUp } from "@/server/admin/topups";
import {
  activateUser,
  adjustUserWallet,
  deleteUser,
  getUserDetail,
  listUsers,
  sendUserPasswordReset,
  suspendUser,
  updateUserProfile,
} from "@/server/admin/users";
import { postAdminUserDelete, postAdminUserStatus } from "@/server/api/admin";
import { createSession, validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { testOutbox } from "@/server/email/mailer";
import { ManualPaymentProvider } from "@/server/payments/manual/manual-provider";
import { setPaymentProviderForTesting } from "@/server/payments/registry";
import { setProviderForTesting } from "@/server/providers/registry";
import { createApiKey, userForApiKey } from "@/server/services/api-key.service";
import * as auth from "@/server/services/auth.service";
import { syncCatalog } from "@/server/services/catalog.service";
import { customerPrice } from "@/server/services/currency";
import { requestNumber } from "@/server/services/order.service";
import { createManualTopUp } from "@/server/services/payment.service";
import { invalidateProviderBalance } from "@/server/services/provider-health.service";
import { clearSettingsCache } from "@/server/services/settings.service";
import { creditWallet, getBalance } from "@/server/services/wallet.service";
import { FakeProvider } from "./fake-provider";
import { createUser, resetDatabase, USD } from "./helpers";

const PASSWORD = "Test-password-1234";
const ctx = { ip: "unknown", userAgent: "vitest" };
const key = () => `k${Math.random().toString(36).slice(2)}${Date.now()}`.padEnd(20, "0");
let usaId: string;

async function admin() {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  const actor: AdminActor = { id: u.id, email: u.email, name: u.name, sessionId: (await validateSessionToken(s.token))!.sessionId, ip: "203.0.113.7" };
  return { user: u, token: s.token, actor };
}

async function customer(balance = 0) {
  const u = await createUser();
  if (balance) await creditWallet({ userId: u.id, amount: balance, type: "DEPOSIT", reference: `fund:${u.id}` });
  const s = await createSession(u.id, { persistent: false, ip: null, userAgent: "vitest" });
  return { user: u, token: s.token };
}

type Handler = (req: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
const call = async (handler: unknown, token: string, id: string, body: unknown) => {
  const res = await (handler as Handler)(
    new NextRequest(`http://localhost:3000/api/admin/users/${id}`, {
      method: "POST",
      headers: { cookie: `rocksms_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  return res.status;
};

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
  testOutbox.length = 0;
  setProviderForTesting(new FakeProvider());
  invalidateProviderBalance();
  await syncCatalog();
  usaId = String((await db().country.findFirstOrThrow({ where: { providerCode: "12" } })).id);
});
afterEach(() => {
  setProviderForTesting(undefined);
  setPaymentProviderForTesting(undefined);
  clearSettingsCache();
});
afterAll(() => db().$disconnect());

describe("suspend and activate", () => {
  it("suspension needs a reason, records who/when/why and locks the account out everywhere", async () => {
    const a = await admin();
    const c = await customer(USD(5));
    const apiKey = (await createApiKey(c.user.id)).key;
    expect(await suspendUser(a.actor, c.user.id, "no")).toMatchObject({ ok: false });
    expect(await suspendUser(a.actor, c.user.id, "Chargeback on top-up TP-123")).toMatchObject({ ok: true });

    const row = await db().user.findUniqueOrThrow({ where: { id: c.user.id } });
    expect(row).toMatchObject({ status: "SUSPENDED", suspensionReason: "Chargeback on top-up TP-123", suspendedById: a.user.id });
    expect(row.suspendedAt).toBeInstanceOf(Date);
    expect(await validateSessionToken(c.token)).toBeNull();
    expect(await userForApiKey(apiKey)).toBeNull();
    expect(await auth.login({ email: c.user.email, password: PASSWORD, remember: false }, ctx)).toEqual({ ok: false, code: "suspended" });
    // Data is kept.
    expect((await getBalance(c.user.id)).balance).toBe(USD(5));
    expect(await getUserDetail(c.user.id)).toMatchObject({ status: "suspended", suspension: { reason: "Chargeback on top-up TP-123", by: a.user.email } });
    expect((await listUsers({ status: "suspended" })).total).toBe(1);

    expect(await activateUser(a.actor, c.user.id)).toMatchObject({ ok: true });
    expect(await auth.login({ email: c.user.email, password: PASSWORD, remember: false }, ctx)).toMatchObject({ ok: true });
    const audit = await db().auditLog.findMany({ where: { targetId: c.user.id, success: true }, orderBy: { id: "asc" } });
    expect(audit.map((x) => x.action)).toEqual(["user.suspended", "user.activated"]);
    expect(audit[0]).toMatchObject({ actorId: a.user.id, ip: "203.0.113.7", description: expect.stringContaining("Chargeback") });
  });

  it("the status API requires a reason to suspend and refuses non-admins", async () => {
    const a = await admin();
    const c = await customer();
    const other = await customer();
    expect(await call(postAdminUserStatus, a.token, c.user.id, { status: "suspended" })).toBe(400);
    expect(await call(postAdminUserStatus, other.token, c.user.id, { status: "suspended", reason: "Trying from a user account" })).toBe(403);
    expect(await call(postAdminUserStatus, a.token, c.user.id, { status: "suspended", reason: "Fraud investigation" })).toBe(200);
  });
});

describe("safe deletion", () => {
  it("refuses while money or live activity depends on the account, for admins, self, and without the typed email", async () => {
    const a = await admin();
    const other = await admin();
    const c = await customer(USD(5));
    expect(await deleteUser(a.actor, c.user.id, "wrong@example.com")).toMatchObject({ ok: false, message: expect.stringMatching(/Type the user's email/) });
    expect(await deleteUser(a.actor, c.user.id, c.user.email)).toMatchObject({ ok: false, message: expect.stringMatching(/still holds/) });
    expect(await deleteUser(a.actor, a.user.id, a.user.email)).toMatchObject({ ok: false });
    expect(await deleteUser(a.actor, other.user.id, other.user.email)).toMatchObject({ ok: false, message: expect.stringMatching(/administrator role/) });

    const d = await customer(USD(5));
    await requestNumber(d.user.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() }); // live number
    await adjustUserWallet(a.actor, d.user.id, { amount: "4.58", reason: "Refund remaining balance", idempotencyKey: key(), direction: "debit" });
    expect(await deleteUser(a.actor, d.user.id, d.user.email)).toMatchObject({ ok: false, message: expect.stringMatching(/live numbers/) });

    setPaymentProviderForTesting(new ManualPaymentProvider());
    const e = await customer();
    await createManualTopUp(e.user.id, { amount: "5", method: "easypaisa", transactionId: `TID${Date.now()}`, idempotencyKey: key() });
    expect(await deleteUser(a.actor, e.user.id, e.user.email)).toMatchObject({ ok: false, message: expect.stringMatching(/pending top-up/) });
    expect(await db().auditLog.count({ where: { action: "user.delete", success: false } })).toBeGreaterThanOrEqual(4);
  });

  it("anonymizes accounts with history and keeps their ledger", async () => {
    const a = await admin();
    const c = await customer(USD(5));
    await adjustUserWallet(a.actor, c.user.id, { amount: "5", reason: "Refund before closing account", idempotencyKey: key(), direction: "debit" });
    await createApiKey(c.user.id);
    expect(await deleteUser(a.actor, c.user.id, c.user.email)).toMatchObject({ ok: true });
    const row = await db().user.findUniqueOrThrow({ where: { id: c.user.id } });
    expect(row).toMatchObject({ name: "Deleted user", email: `deleted+${c.user.id}@deleted.invalid`, status: "SUSPENDED", apiKeyHash: null });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(await db().transaction.count({ where: { userId: c.user.id } })).toBe(2);
    expect(await validateSessionToken(c.token)).toBeNull();
    expect(await auth.login({ email: c.user.email, password: PASSWORD, remember: false }, ctx)).toMatchObject({ ok: false });
    expect((await listUsers()).items.map((u) => u.id)).not.toContain(c.user.id);
    expect((await listUsers({ status: "deleted" })).items.map((u) => u.id)).toEqual([c.user.id]);
    expect(await db().auditLog.findFirst({ where: { action: "user.deleted" } })).toMatchObject({ success: true, metadata: expect.objectContaining({ mode: "anonymized" }) });
  });

  it("removes accounts without any history completely (through the admin API)", async () => {
    const a = await admin();
    const c = await customer();
    expect(await call(postAdminUserDelete, a.token, c.user.id, { confirmEmail: c.user.email })).toBe(200);
    expect(await db().user.findUnique({ where: { id: c.user.id } })).toBeNull();
    expect(await db().wallet.count({ where: { userId: c.user.id } })).toBe(0);
    expect(await db().auditLog.findFirst({ where: { action: "user.deleted", targetId: c.user.id } })).toMatchObject({ metadata: expect.objectContaining({ mode: "hard" }) });
  });
});

describe("edit, password reset", () => {
  it("edits name and email with validation; an email change logs the user out", async () => {
    const a = await admin();
    const c = await customer();
    const taken = await customer();
    expect(await updateUserProfile(a.actor, c.user.id, { name: "New Name", email: taken.user.email })).toMatchObject({ ok: false, message: expect.stringMatching(/already uses/) });
    expect(await updateUserProfile(a.actor, c.user.id, { name: "", email: "x@example.com" })).toMatchObject({ ok: false });
    expect(await updateUserProfile(a.actor, c.user.id, { name: "New Name", email: "changed@example.com" })).toMatchObject({ ok: true });
    expect(await db().user.findUniqueOrThrow({ where: { id: c.user.id } })).toMatchObject({ name: "New Name", email: "changed@example.com" });
    expect(await validateSessionToken(c.token)).toBeNull();
    expect(await db().auditLog.findFirst({ where: { action: "user.updated" } })).toMatchObject({ success: true });
  });

  it("sends a password-reset link without the admin seeing a password", async () => {
    const a = await admin();
    const c = await customer();
    expect(await sendUserPasswordReset(a.actor, c.user.id)).toMatchObject({ ok: true });
    expect(testOutbox.at(-1)).toMatchObject({ to: c.user.email, text: expect.stringContaining("/reset-password?token=") });
  });
});

describe("wallet credit and deduction", () => {
  it("add and deduct write one ledger row and one audit row each, atomically", async () => {
    const a = await admin();
    const c = await customer();
    const k = key();
    await Promise.all([
      adjustUserWallet(a.actor, c.user.id, { amount: "10", reason: "WhatsApp top-up 1042", idempotencyKey: k, direction: "credit" }),
      adjustUserWallet(a.actor, c.user.id, { amount: "10", reason: "WhatsApp top-up 1042", idempotencyKey: k, direction: "credit" }),
    ]);
    expect(await adjustUserWallet(a.actor, c.user.id, { amount: "3", reason: "Correction for test", idempotencyKey: key(), direction: "debit" })).toMatchObject({ ok: true });
    expect(await adjustUserWallet(a.actor, c.user.id, { amount: "50", reason: "Too large a deduction", idempotencyKey: key(), direction: "debit" })).toMatchObject({ ok: false, message: expect.stringMatching(/negative/) });
    expect((await getBalance(c.user.id)).balance).toBe(USD(7));
    expect(await db().transaction.count({ where: { userId: c.user.id, type: "ADJUSTMENT" } })).toBe(2);
    expect(await db().auditLog.count({ where: { action: { in: ["wallet.credited", "wallet.debited"] }, success: true } })).toBe(2);
    expect(await db().auditLog.count({ where: { action: "wallet.debit", success: false } })).toBe(1);
  });
});

describe("admin seeder (ensureAdmin)", () => {
  it("creates the admin from a supplied password, and re-running changes nothing", async () => {
    const first = await ensureAdmin({ email: "Boss@Example.com", name: "Boss", password: "Strong-admin-2026" });
    expect(first).toMatchObject({ email: "boss@example.com", created: true, password: "set_from_input" });
    const row = await db().user.findUniqueOrThrow({ where: { email: "boss@example.com" } });
    expect(row).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
    expect(row.emailVerifiedAt).toBeInstanceOf(Date);
    expect(row.passwordHash).not.toContain("Strong-admin-2026");
    expect(await auth.login({ email: "boss@example.com", password: "Strong-admin-2026", remember: false }, ctx)).toMatchObject({ ok: true });
    expect(await db().wallet.count({ where: { userId: row.id } })).toBe(1);

    // Idempotent: no duplicate, password untouched even if a different one is supplied.
    const again = await ensureAdmin({ email: "boss@example.com", password: "Another-pass-2027" });
    expect(again).toMatchObject({ created: false, repaired: [], password: "unchanged" });
    expect(await db().user.count({ where: { email: "boss@example.com" } })).toBe(1);
    expect(await auth.login({ email: "boss@example.com", password: "Strong-admin-2026", remember: false }, ctx)).toMatchObject({ ok: true });
    // …unless a reset is explicitly requested.
    expect(await ensureAdmin({ email: "boss@example.com", password: "Another-pass-2027", resetPassword: true })).toMatchObject({ password: "set_from_input" });
    expect(await auth.login({ email: "boss@example.com", password: "Another-pass-2027", remember: false }, ctx)).toMatchObject({ ok: true });
  });

  it("without a password, emails a setup link instead of inventing one", async () => {
    expect(await ensureAdmin({ email: "owner@example.com" })).toMatchObject({ created: true, password: "setup_link_emailed" });
    expect(testOutbox.at(-1)).toMatchObject({ to: "owner@example.com", text: expect.stringContaining("/reset-password?token=") });
  });

  it("repairs an existing account (role, status, verification) and refuses weak passwords or deleted accounts", async () => {
    const a = await admin();
    const c = await customer();
    await suspendUser(a.actor, c.user.id, "Suspended before promotion");
    await db().user.update({ where: { id: c.user.id }, data: { emailVerifiedAt: null } });
    const r = await ensureAdmin({ email: c.user.email });
    expect(r.repaired).toEqual(["role → admin", "status → active", "email → verified"]);
    expect(await db().user.findUniqueOrThrow({ where: { id: c.user.id } })).toMatchObject({ role: "ADMIN", status: "ACTIVE" });

    await expect(ensureAdmin({ email: "weak@example.com", password: "short" })).rejects.toThrow(/not strong enough/);
    await expect(ensureAdmin({ email: "not-an-email" })).rejects.toThrow(/Invalid admin email/);
    const gone = await customer(USD(1));
    await adjustUserWallet(a.actor, gone.user.id, { amount: "1", reason: "Close before deletion", idempotencyKey: key(), direction: "debit" });
    await deleteUser(a.actor, gone.user.id, gone.user.email);
    const deletedEmail = (await db().user.findUniqueOrThrow({ where: { id: gone.user.id } })).email;
    await expect(ensureAdmin({ email: deletedEmail })).rejects.toThrow(/deleted/);
  });
});

describe("dashboard, ledger, wallets and audit logs", () => {
  it("dashboard revenue and counts come from real records", async () => {
    const a = await admin();
    const c = await customer(USD(5));
    const s = await customer();
    await suspendUser(a.actor, s.user.id, "Testing the dashboard counts");
    await requestNumber(c.user.id, { service: "tg", country: usaId, price: customerPrice(3500), idempotencyKey: key() });
    setPaymentProviderForTesting(new ManualPaymentProvider());
    const t = await createManualTopUp(c.user.id, { amount: "2", method: "jazzcash", transactionId: `JC${Date.now()}`, idempotencyKey: key() });
    if (!t.ok) throw new Error(t.message);
    await approveTopUp(a.actor, t.payment.id);
    const d = await getDashboard();
    expect(d).toMatchObject({
      users: { total: 3, active: 2, suspended: 1 },
      orders: { total: 1, pending: 1 },
      topups: { pending: 0, approved: 1, approvedAmount: USD(2), rejected: 0 },
      revenue: { today: { sales: customerPrice(3500) }, month: { sales: customerPrice(3500) } },
    });
    expect(d.recentTopUps[0]).toMatchObject({ status: "paid" });
    expect(d.recentUsers).toHaveLength(3);
  });

  it("ledger, wallets and audit logs filter on the server", async () => {
    const a = await admin();
    const c = await customer(USD(5));
    const d = await customer();
    await adjustUserWallet(a.actor, c.user.id, { amount: "1", reason: "Loyalty credit", idempotencyKey: key(), direction: "credit" });
    const ledger = await listLedger({ userId: c.user.id });
    expect(ledger.total).toBe(2);
    expect(ledger.items[0]).toMatchObject({ type: "adjustment", balanceBefore: USD(5), balanceAfter: USD(6), source: { kind: "admin", id: a.user.id } });
    expect((await listLedger({ type: "deposit" })).total).toBe(1);
    expect((await listLedger({ q: "Loyalty" })).total).toBe(1);

    expect((await listWallets({ nonZero: true })).items.map((w) => w.user.id)).toEqual([c.user.id]);
    expect((await listWallets({ sort: "balance_asc" })).items[0].user.id).not.toBe(c.user.id);
    expect((await listWallets({ q: d.user.email })).total).toBe(1);

    await suspendUser(a.actor, d.user.id, "no"); // refused (reason too short) → nothing audited
    await suspendUser(a.actor, a.user.id, "Self suspension attempt"); // refused → audited as failure
    expect((await listAuditLogs({ action: "wallet.credited" })).total).toBe(1);
    expect((await listAuditLogs({ success: false })).items.map((x) => x.action)).toEqual(["user.suspend"]);
    expect((await listAuditLogs({ actor: a.user.email })).total).toBe(2);
    expect((await listAuditLogs({ q: "Loyalty" })).total).toBe(1);
  });
});
