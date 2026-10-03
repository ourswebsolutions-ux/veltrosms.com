import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
} from "@/lib/validation/auth";
import { can } from "@/server/auth/authorization";
import { verifyPassword } from "@/server/auth/password";
import { deleteSessionByToken, validateSessionToken } from "@/server/auth/session";
import { hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { testOutbox } from "@/server/email/mailer";
import * as auth from "@/server/services/auth.service";
import { resetDatabase } from "./helpers";

const ctx = { ip: "unknown", userAgent: "vitest" };
const PASSWORD = "correct-horse-42";
const EMAIL = "ada@example.com";

/** Pulls the ?token= value out of the most recent email to `to`. */
function tokenFromEmail(to: string, path: string): string {
  const mail = [...testOutbox].reverse().find((m) => m.to === to && m.text.includes(path));
  if (!mail) throw new Error(`no ${path} email for ${to}`);
  const match = mail.text.match(new RegExp(`${path}\\?token=([A-Za-z0-9_%-]+)`));
  if (!match) throw new Error("no token in email");
  return decodeURIComponent(match[1]);
}

/** Signup needs no email confirmation: the account can log in immediately. */
async function registerAndVerify(email = EMAIL, password = PASSWORD) {
  const result = await auth.register({ name: "Ada Lovelace", email, password }, ctx);
  expect(result.ok).toBe(true);
}

beforeEach(async () => {
  await resetDatabase();
  testOutbox.length = 0;
});

afterAll(async () => {
  await db().$disconnect();
});

/* ------------------------------------------------------------ validation -- */

describe("input validation (shared client/server rules)", () => {
  const valid = { name: "Ada Lovelace", email: EMAIL, password: PASSWORD, confirm: PASSWORD, consent: "on" };

  it("accepts a valid registration and normalizes the email", () => {
    const r = registerSchema.safeParse({ ...valid, email: "  Ada@Example.COM " });
    expect(r.success && r.data.email).toBe("ada@example.com");
  });

  it("rejects an invalid email", () => {
    const r = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).email).toMatch(/valid email/);
  });

  it.each([
    ["short1", /at least 10/],
    ["onlyletterslong", /letters and numbers/],
    ["password123", /too common/],
    ["ada-lovelace-123", /name|email/],
  ])("rejects weak password %s", (password, message) => {
    const r = registerSchema.safeParse({ ...valid, email: "ada.lovelace@example.com", password, confirm: password });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).password).toMatch(message);
  });

  it("rejects mismatched passwords", () => {
    const r = registerSchema.safeParse({ ...valid, confirm: "different-pass-99" });
    expect(fieldErrors(r.error!).confirm).toMatch(/don't match/);
  });

  it("rejects names with markup", () => {
    const r = registerSchema.safeParse({ ...valid, name: "<script>alert(1)</script>" });
    expect(fieldErrors(r.error!).name).toBeTruthy();
  });

  it("requires consent", () => {
    const r = registerSchema.safeParse({ ...valid, consent: undefined });
    expect(fieldErrors(r.error!).consent).toBeTruthy();
  });

  it("validates login, reset and change-password inputs", () => {
    expect(loginSchema.safeParse({ email: EMAIL, password: "" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "x".repeat(43), password: "weak", confirm: "weak" }).success).toBe(false);
    const same = changePasswordSchema.safeParse({ current: PASSWORD, next: PASSWORD, confirm: PASSWORD });
    expect(fieldErrors(same.error!).next).toMatch(/different/);
  });

  it("only allows same-site relative redirects", () => {
    expect(safeNextPath("/profile/history?tab=orders")).toBe("/profile/history?tab=orders");
    expect(safeNextPath("//evil.com")).toBe("/profile");
    expect(safeNextPath("https://evil.com")).toBe("/profile");
    expect(safeNextPath("/\\evil.com")).toBe("/profile");
    expect(safeNextPath(undefined)).toBe("/profile");
  });
});

/* ---------------------------------------------------------- registration -- */

describe("registration (no email confirmation)", () => {
  it("creates an active, ready-to-use user with a hashed password and a wallet, and signs it in", async () => {
    const r = await auth.register({ name: "Ada Lovelace", email: EMAIL, password: PASSWORD }, ctx);
    expect(r.ok).toBe(true);
    const user = await db().user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.status).toBe("ACTIVE");
    expect(user.role).toBe("USER");
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(PASSWORD, user.passwordHash)).toBe(true);
    const wallet = await db().wallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balance.toString()).toBe("0");
    // Signed in straight away, and no confirmation email or token.
    expect(r.ok && (await validateSessionToken(r.session.token))?.email).toBe(EMAIL);
    expect(testOutbox.some((m) => m.text.includes("/verify-email"))).toBe(false);
    expect(await db().authToken.count()).toBe(0);
  });

  it("can log in immediately after signing up", async () => {
    await auth.register({ name: "Ada Lovelace", email: EMAIL, password: PASSWORD }, ctx);
    const login = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    expect(login.ok).toBe(true);
  });

  it("rejects a duplicate email without creating a second account", async () => {
    await auth.register({ name: "Ada Lovelace", email: EMAIL, password: PASSWORD }, ctx);
    const second = await auth.register({ name: "Someone Else", email: EMAIL, password: "another-pass-77" }, ctx);
    expect(second).toEqual({ ok: false, code: "email_taken" });
    expect(await db().user.count()).toBe(1);
  });

  it("existing accounts that were never confirmed can log in", async () => {
    await auth.register({ name: "Ada Lovelace", email: EMAIL, password: PASSWORD }, ctx);
    await db().user.updateMany({ data: { emailVerifiedAt: null } });
    const r = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    expect(r.ok).toBe(true);
    expect(r.ok && (await validateSessionToken(r.session.token))?.email).toBe(EMAIL);
  });

  it("rate limits repeated signups from one IP", async () => {
    const ipCtx = { ip: "203.0.113.9", userAgent: "vitest" };
    for (let i = 0; i < 5; i++) await auth.register({ name: "Ada Lovelace", email: `ada${i}@example.com`, password: PASSWORD }, ipCtx);
    const r = await auth.register({ name: "Ada Lovelace", email: "ada9@example.com", password: PASSWORD }, ipCtx);
    expect(r).toMatchObject({ ok: false, code: "rate_limited" });
  });
});

/* ----------------------------------------------------------------- login -- */

describe("login", () => {
  it("logs in with correct credentials and creates a valid session", async () => {
    await registerAndVerify();
    const r = await auth.login({ email: EMAIL, password: PASSWORD, remember: true }, ctx);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const user = await validateSessionToken(r.session.token);
    expect(user?.email).toBe(EMAIL);
    expect(user?.name).toBe("Ada Lovelace");
    expect(r.session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    // The cookie token is not stored in plain form (signup also opened a session, so look this one up by its hash).
    const stored = await db().session.findFirst({ where: { tokenHash: hashToken(r.session.token) } });
    expect(stored).not.toBeNull();
    expect(await db().session.count({ where: { tokenHash: r.session.token } })).toBe(0);
  });

  it("uses a short server-side expiry without 'remember me'", async () => {
    await registerAndVerify();
    const r = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    expect(r.ok && r.session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(12 * 3_600_000);
  });

  it("returns the same error for a wrong password and an unknown email", async () => {
    await registerAndVerify();
    expect(await auth.login({ email: EMAIL, password: "wrong-password-1", remember: false }, ctx)).toEqual({ ok: false, code: "invalid" });
    expect(await auth.login({ email: "nobody@example.com", password: PASSWORD, remember: false }, ctx)).toEqual({ ok: false, code: "invalid" });
  });

  it("blocks disabled accounts and invalidates their existing sessions", async () => {
    await registerAndVerify();
    const r = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    await db().user.updateMany({ data: { status: "SUSPENDED" } });
    expect(await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx)).toEqual({ ok: false, code: "suspended" });
    expect(r.ok && (await validateSessionToken(r.session.token))).toBeNull();
  });

  it("locks out after repeated failures, even with the right password, and for unknown emails", async () => {
    await registerAndVerify();
    for (let i = 0; i < 5; i++) await auth.login({ email: EMAIL, password: "wrong-password-1", remember: false }, ctx);
    expect(await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx)).toMatchObject({ ok: false, code: "rate_limited" });
    for (let i = 0; i < 5; i++) await auth.login({ email: "ghost@example.com", password: "x", remember: false }, ctx);
    expect(await auth.login({ email: "ghost@example.com", password: "x", remember: false }, ctx)).toMatchObject({ code: "rate_limited" });
  });

  it("applies per-IP limits when the client IP is known", async () => {
    const ipCtx = { ip: "203.0.113.9", userAgent: "vitest" };
    for (let i = 0; i < 30; i++) await auth.login({ email: `u${i}@example.com`, password: "x", remember: false }, ipCtx);
    expect(await auth.login({ email: "fresh@example.com", password: "x", remember: false }, ipCtx)).toMatchObject({ code: "rate_limited" });
  });
});

/* -------------------------------------------------------- password reset -- */

describe("password reset", () => {
  it("sends a reset link for a known account", async () => {
    await registerAndVerify();
    expect(await auth.requestPasswordReset(EMAIL, ctx)).toEqual({ ok: true });
    expect(tokenFromEmail(EMAIL, "/reset-password")).toBeTruthy();
  });

  it("answers identically for unknown emails and sends nothing", async () => {
    expect(await auth.requestPasswordReset("nobody@example.com", ctx)).toEqual({ ok: true });
    expect(testOutbox).toHaveLength(0);
  });

  it("changes the password, revokes sessions and cannot be reused", async () => {
    await registerAndVerify();
    const before = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    await auth.requestPasswordReset(EMAIL, ctx);
    const token = tokenFromEmail(EMAIL, "/reset-password");

    expect(await auth.checkToken(token, "PASSWORD_RESET")).toMatchObject({ ok: true });
    expect(await auth.resetPassword(token, "brand-new-pass-7")).toEqual({ ok: true });
    expect(before.ok && (await validateSessionToken(before.session.token))).toBeNull();
    expect(await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx)).toEqual({ ok: false, code: "invalid" });
    expect((await auth.login({ email: EMAIL, password: "brand-new-pass-7", remember: false }, ctx)).ok).toBe(true);
    expect(await auth.resetPassword(token, "another-pass-88")).toEqual({ ok: false, reason: "used" });
    expect(testOutbox.at(-1)?.subject).toMatch(/password was changed/);
  });

  it("rejects expired and invalid tokens", async () => {
    await registerAndVerify();
    await auth.requestPasswordReset(EMAIL, ctx);
    const token = tokenFromEmail(EMAIL, "/reset-password");
    await db().authToken.updateMany({ where: { purpose: "PASSWORD_RESET" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await auth.resetPassword(token, "brand-new-pass-7")).toEqual({ ok: false, reason: "expired" });
    expect(await auth.resetPassword("x".repeat(43), "brand-new-pass-7")).toEqual({ ok: false, reason: "invalid" });
  });

  it("only the newest reset link works", async () => {
    await registerAndVerify();
    await auth.requestPasswordReset(EMAIL, ctx);
    const first = tokenFromEmail(EMAIL, "/reset-password");
    await auth.requestPasswordReset(EMAIL, ctx);
    expect(await auth.resetPassword(first, "brand-new-pass-7")).toEqual({ ok: false, reason: "used" });
  });

  it("password reset works and the new password logs in", async () => {
    await auth.register({ name: "Ada Lovelace", email: EMAIL, password: PASSWORD }, ctx);
    await auth.requestPasswordReset(EMAIL, ctx);
    await auth.resetPassword(tokenFromEmail(EMAIL, "/reset-password"), "brand-new-pass-7");
    expect((await auth.login({ email: EMAIL, password: "brand-new-pass-7", remember: false }, ctx)).ok).toBe(true);
  });
});

/* -------------------------------------------------------------- sessions -- */

describe("sessions", () => {
  async function loggedIn() {
    await registerAndVerify();
    const r = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    if (!r.ok) throw new Error("login failed");
    return r.session.token;
  }

  it("logout invalidates the session", async () => {
    const token = await loggedIn();
    await deleteSessionByToken(token);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("expired sessions are rejected", async () => {
    const token = await loggedIn();
    await db().session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("rejects garbage tokens", async () => {
    expect(await validateSessionToken("")).toBeNull();
    expect(await validateSessionToken("x".repeat(500))).toBeNull();
    expect(await validateSessionToken("' or 1=1 --")).toBeNull();
  });

  it("changing the password rotates the session and logs out other devices", async () => {
    const tokenA = await loggedIn();
    const second = await auth.login({ email: EMAIL, password: PASSWORD, remember: false }, ctx);
    const user = (await validateSessionToken(tokenA))!;

    expect(await auth.changePassword(user, { current: "wrong-password-1", next: "brand-new-pass-7", persistent: false }, ctx)).toEqual({
      ok: false,
      code: "wrong_password",
    });
    const changed = await auth.changePassword(user, { current: PASSWORD, next: "brand-new-pass-7", persistent: false }, ctx);
    expect(changed.ok).toBe(true);
    expect(await validateSessionToken(tokenA)).toBeNull();
    expect(second.ok && (await validateSessionToken(second.session.token))).toBeNull();
    expect(changed.ok && (await validateSessionToken(changed.session.token))?.email).toBe(EMAIL);
  });

  it("updates the profile name", async () => {
    const token = await loggedIn();
    const user = (await validateSessionToken(token))!;
    await auth.updateProfile(user.id, { name: "Augusta Ada" });
    expect((await validateSessionToken(token))?.name).toBe("Augusta Ada");
  });
});

/* --------------------------------------------------------- authorization -- */

describe("authorization", () => {
  it("grants permissions by role", () => {
    expect(can({ role: "user" }, "account:update")).toBe(true);
    expect(can({ role: "user" }, "admin:access")).toBe(false);
    expect(can({ role: "admin" }, "admin:access")).toBe(true);
    expect(can(null, "account:read")).toBe(false);
  });
});
