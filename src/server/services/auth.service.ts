import "server-only";
import { hashPassword, needsRehash, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { hitRateLimit, RATE_LIMITS, resetRateLimit, type RateLimitRule } from "@/server/auth/rate-limit";
import type { RequestContext } from "@/server/auth/request";
import { createSession, deleteUserSessions, type SessionUser } from "@/server/auth/session";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { db, isUniqueViolation } from "@/server/db";
import { sendEmail, type EmailMessage } from "@/server/email/mailer";
import {
  emailChangeConfirmEmail,
  emailChangedEmail,
  emailChangeRequestedEmail,
  emailInUseEmail,
  maskEmail,
  passwordChangedEmail,
  passwordResetEmail,
} from "@/server/email/templates";
import { env } from "@/server/env";
import { platformCurrency } from "./currency";
import { logSecurityEvent } from "./security-log";

/**
 * Authentication business logic. Framework-free (no cookies/headers): server
 * actions call these and handle cookies/redirects; tests call them directly.
 *
 * Signup needs no email confirmation: a new account can log in straight away
 * (registration signs it in). Forgot-password still answers the same whether
 * or not the email is registered; login only reveals "suspended" after the
 * correct password was supplied.
 */

const RESET_TTL_MINUTES = 30;
const EMAIL_CHANGE_TTL_HOURS = 24;

type TokenPurpose = "PASSWORD_RESET" | "EMAIL_CHANGE";
export type TokenFailure = "invalid" | "expired" | "used";
type Limited = { ok: false; code: "rate_limited"; retryAfterSeconds: number };

const url = (pathname: string, token?: string) =>
  `${env().APP_URL.replace(/\/$/, "")}${pathname}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

async function checkLimits(checks: [string, RateLimitRule][]): Promise<Limited | null> {
  for (const [key, rule] of checks) {
    const r = await hitRateLimit(key, rule);
    if (!r.allowed) return { ok: false, code: "rate_limited", retryAfterSeconds: r.retryAfterSeconds };
  }
  return null;
}

/** Per-IP keys only when we actually know the client IP (see TRUST_PROXY). */
function ipCheck(ctx: RequestContext, prefix: string, rule: RateLimitRule): [string, RateLimitRule][] {
  return ctx.ip && ctx.ip !== "unknown" ? [[`${prefix}:ip:${ctx.ip}`, rule]] : [];
}

async function trySend(message: EmailMessage, purpose: string) {
  try {
    await sendEmail(message);
  } catch (error) {
    // Never log the message (it contains the link); log the failure reason only.
    console.error(`[auth] failed to send ${purpose} email:`, error instanceof Error ? error.message : "unknown error");
  }
}

const findUserByEmail = (email: string) => db().user.findUnique({ where: { email } });

/* ---------------------------------------------------------------- tokens -- */

async function issueToken(userId: string, purpose: TokenPurpose, ttlMs: number, extra: { newEmail?: string } = {}): Promise<string> {
  const token = generateToken();
  await db().$transaction([
    // Only the newest link works: retire any earlier unused tokens.
    db().authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    db().authToken.create({
      data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs), newEmail: extra.newEmail ?? null },
    }),
  ]);
  return token;
}

/** Inspects a token without using it (for rendering the reset form). */
export async function checkToken(
  token: string,
  purpose: TokenPurpose,
): Promise<{ ok: true; userId: string; newEmail: string | null } | { ok: false; reason: TokenFailure }> {
  if (!token || token.length < 20 || token.length > 200) return { ok: false, reason: "invalid" };
  const row = await db().authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== purpose) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: row.userId, newEmail: row.newEmail };
}

/** Marks a token used exactly once (atomic: concurrent reuse loses). */
async function consumeToken(token: string, purpose: TokenPurpose) {
  const check = await checkToken(token, purpose);
  if (!check.ok) return check;
  const { count } = await db().authToken.updateMany({
    where: { tokenHash: hashToken(token), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) return { ok: false as const, reason: "used" as const };
  return check;
}

/* ---------------------------------------------------------- registration -- */

export type RegisterResult =
  | { ok: true; session: { token: string; expiresAt: Date; persistent: boolean } }
  | { ok: false; code: "email_taken" }
  | Limited;

/** Creates the account (with its wallet) and signs it in — no email confirmation step. */
export async function register(
  input: { name: string; email: string; password: string },
  ctx: RequestContext,
): Promise<RegisterResult> {
  const limited = await checkLimits(ipCheck(ctx, "register", RATE_LIMITS.registerPerIp));
  if (limited) return limited;

  if (await findUserByEmail(input.email)) return { ok: false, code: "email_taken" };

  const passwordHash = await hashPassword(input.password);
  let userId: string;
  try {
    const user = await db().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        emailVerifiedAt: new Date(),
        // Every account gets exactly one wallet, created with the user.
        wallet: { create: { currency: platformCurrency().code } },
      },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    // Email taken by a concurrent signup.
    if (isUniqueViolation(error)) return { ok: false, code: "email_taken" };
    throw error;
  }

  const session = await createSession(userId, { persistent: false, ip: ctx.ip, userAgent: ctx.userAgent });
  await logSecurityEvent("register", { userId, ip: ctx.ip });
  return { ok: true, session };
}

/* ----------------------------------------------------------------- login -- */

export type LoginResult =
  | { ok: true; session: { token: string; expiresAt: Date; persistent: boolean } }
  | { ok: false; code: "invalid" | "suspended" }
  | Limited;

export async function login(
  input: { email: string; password: string; remember: boolean },
  ctx: RequestContext,
): Promise<LoginResult> {
  const emailKey = `login:email:${input.email}`;
  // Applied to unknown emails too, so lockouts don't reveal which accounts exist.
  const limited = await checkLimits([
    ...ipCheck(ctx, "login", RATE_LIMITS.loginPerIp),
    [emailKey, RATE_LIMITS.loginPerEmail],
  ]);
  if (limited) return limited;

  const user = await findUserByEmail(input.email);
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : await verifyAgainstDummy(input.password);
  if (!user || !valid) {
    await logSecurityEvent("login_failed", { userId: user?.id ?? null, ip: ctx.ip, email: input.email });
    return { ok: false, code: "invalid" };
  }

  // Correct password proves ownership, so these states can be disclosed now.
  if (user.status !== "ACTIVE") {
    await logSecurityEvent("login_blocked", { userId: user.id, ip: ctx.ip, detail: "account suspended" });
    return { ok: false, code: "suspended" };
  }

  await resetRateLimit(emailKey);
  if (needsRehash(user.passwordHash)) {
    await db().user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
  }
  const session = await createSession(user.id, { persistent: input.remember, ip: ctx.ip, userAgent: ctx.userAgent });
  await logSecurityEvent("login_success", { userId: user.id, ip: ctx.ip });
  return { ok: true, session };
}

/* -------------------------------------------------------- password reset -- */

export async function requestPasswordReset(email: string, ctx: RequestContext): Promise<{ ok: true } | Limited> {
  const limited = await checkLimits([
    ...ipCheck(ctx, "email", RATE_LIMITS.emailPerIp),
    [`email:addr:${email}`, RATE_LIMITS.emailPerAddress],
  ]);
  if (limited) return limited;

  const user = await findUserByEmail(email);
  if (user && user.status === "ACTIVE") {
    const token = await issueToken(user.id, "PASSWORD_RESET", RESET_TTL_MINUTES * 60_000);
    await trySend(passwordResetEmail(user.email, user.name, url("/reset-password", token), RESET_TTL_MINUTES), "password-reset");
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true } | { ok: false; reason: TokenFailure }> {
  const result = await consumeToken(token, "PASSWORD_RESET");
  if (!result.ok) return result;
  const now = new Date();
  const user = await db().user.update({
    where: { id: result.userId },
    data: {
      passwordHash: await hashPassword(password),
      passwordChangedAt: now,
    },
    select: { email: true, name: true },
  });
  // Log out everywhere and retire any other outstanding reset links.
  await deleteUserSessions(result.userId);
  await db().authToken.updateMany({
    where: { userId: result.userId, purpose: "PASSWORD_RESET", usedAt: null },
    data: { usedAt: now },
  });
  await trySend(passwordChangedEmail(user.email, user.name, url("/forgot-password")), "password-changed");
  await logSecurityEvent("password_reset", { userId: result.userId });
  return { ok: true };
}

/* ------------------------------------------------------- account changes -- */

export type ChangePasswordResult =
  | { ok: true; session: { token: string; expiresAt: Date; persistent: boolean } }
  | { ok: false; code: "wrong_password" }
  | Limited;

/** Verifies the current password, rotates the session and logs out other devices. */
export async function changePassword(
  user: SessionUser,
  input: { current: string; next: string; persistent: boolean },
  ctx: RequestContext,
): Promise<ChangePasswordResult> {
  const limited = await checkLimits([[`pwchange:user:${user.id}`, RATE_LIMITS.passwordChangePerUser]]);
  if (limited) return limited;

  const row = await db().user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(input.current, row.passwordHash))) return { ok: false, code: "wrong_password" };

  const now = new Date();
  await db().user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.next), passwordChangedAt: now },
  });
  await deleteUserSessions(user.id);
  // The new session starts at the change instant, so it passes the check.
  const session = await createSession(user.id, {
    persistent: input.persistent,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    createdAt: now,
  });
  await trySend(passwordChangedEmail(user.email, user.name, url("/forgot-password")), "password-changed");
  await logSecurityEvent("password_changed", { userId: user.id, ip: ctx.ip });
  return { ok: true, session };
}

export async function updateProfile(userId: string, input: { name: string }): Promise<void> {
  await db().user.update({ where: { id: userId }, data: { name: input.name } });
}

export type EmailChangeResult = { ok: true } | { ok: false; code: "wrong_password" | "same_email" } | Limited;

/**
 * Starts an email change: the new address must be confirmed from its inbox
 * before it replaces the login email. Requires the current password. Whether
 * the new address is already taken is never revealed to the requester (its
 * owner is told by email instead).
 */
export async function requestEmailChange(
  user: SessionUser,
  input: { password: string; newEmail: string },
  ctx: RequestContext,
): Promise<EmailChangeResult> {
  const limited = await checkLimits([
    [`emailchange:user:${user.id}`, RATE_LIMITS.emailChangePerUser],
    [`email:addr:${input.newEmail}`, RATE_LIMITS.emailPerAddress],
    ...ipCheck(ctx, "emailchange", RATE_LIMITS.emailPerIp),
  ]);
  if (limited) return limited;

  const row = await db().user.findUnique({ where: { id: user.id }, select: { passwordHash: true, email: true, name: true } });
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) return { ok: false, code: "wrong_password" };
  if (input.newEmail === row.email) return { ok: false, code: "same_email" };

  const taken = await findUserByEmail(input.newEmail);
  if (taken) {
    await trySend(emailInUseEmail(taken.email, taken.name, url("/forgot-password")), "email-in-use");
    return { ok: true };
  }
  const token = await issueToken(user.id, "EMAIL_CHANGE", EMAIL_CHANGE_TTL_HOURS * 3_600_000, { newEmail: input.newEmail });
  await trySend(emailChangeConfirmEmail(input.newEmail, row.name, url("/confirm-email", token), EMAIL_CHANGE_TTL_HOURS), "email-change-confirm");
  await trySend(emailChangeRequestedEmail(row.email, row.name, maskEmail(input.newEmail), url("/forgot-password")), "email-change-notice");
  await logSecurityEvent("email_change_requested", { userId: user.id, ip: ctx.ip });
  return { ok: true };
}

/** The unconfirmed new address, if a change is waiting for confirmation. */
export async function pendingEmailChange(userId: string): Promise<string | null> {
  const row = await db().authToken.findFirst({
    where: { userId, purpose: "EMAIL_CHANGE", usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { newEmail: true },
  });
  return row?.newEmail ?? null;
}

/** Cancels a pending change (the link stops working). */
export async function cancelEmailChange(userId: string): Promise<void> {
  await db().authToken.updateMany({ where: { userId, purpose: "EMAIL_CHANGE", usedAt: null }, data: { usedAt: new Date() } });
}

/** The address a confirmation link would switch to (for the confirm page). */
export async function inspectEmailChange(token: string): Promise<{ ok: true; newEmail: string } | { ok: false; reason: TokenFailure }> {
  const check = await checkToken(token, "EMAIL_CHANGE");
  if (!check.ok) return check;
  return check.newEmail ? { ok: true, newEmail: check.newEmail } : { ok: false, reason: "invalid" };
}

/**
 * Applies a confirmed email change (single use). All sessions are revoked:
 * the account is re-entered with the new email.
 */
export async function confirmEmailChange(token: string): Promise<{ ok: true } | { ok: false; reason: TokenFailure | "taken" }> {
  const check = await consumeToken(token, "EMAIL_CHANGE");
  if (!check.ok) return check;
  if (!check.newEmail) return { ok: false, reason: "invalid" };
  const user = await db().user.findUnique({ where: { id: check.userId }, select: { email: true, name: true } });
  if (!user) return { ok: false, reason: "invalid" };
  try {
    await db().user.update({ where: { id: check.userId }, data: { email: check.newEmail, emailVerifiedAt: new Date() } });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "taken" };
    throw error;
  }
  await deleteUserSessions(check.userId);
  await trySend(emailChangedEmail(user.email, user.name, maskEmail(check.newEmail)), "email-changed");
  await logSecurityEvent("email_changed", { userId: check.userId });
  return { ok: true };
}

export async function isSessionPersistent(sessionId: string): Promise<boolean> {
  const row = await db().session.findUnique({ where: { id: sessionId }, select: { persistent: true } });
  return row?.persistent ?? false;
}
