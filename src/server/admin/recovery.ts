import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { hashPassword } from "@/server/auth/password";
import { hitRateLimit, RATE_LIMITS, resetRateLimit, type RateLimitRule } from "@/server/auth/rate-limit";
import type { RequestContext } from "@/server/auth/request";
import { db, isUniqueViolation } from "@/server/db";
import { env } from "@/server/env";
import { platformCurrency } from "@/server/services/currency";
import { audit, auditInTx } from "./audit";

/**
 * Emergency admin recovery (/hidden): replaces every administrator with one
 * account (the submitted email + password) when the normal admin login is
 * unavailable.
 *
 * Knowing the URL is not enough: each submission must carry the owner's
 * ADMIN_RECOVERY_SECRET (server environment, configured once, at least 64
 * characters), compared in constant time on the server. Unset or shorter →
 * recovery is off. Attempts are rate limited before the secret is checked,
 * and every failure looks the same to the caller.
 * ADMIN_RECOVERY_ALLOWED_IPS (optional) further limits it to those client IPs
 * (needs TRUST_PROXY=true so the real IP is known).
 *
 * Previous admins are demoted to USER and suspended (data kept, sessions and
 * API keys stop working). Normal user accounts are never modified.
 */

export const MIN_SECRET_LENGTH = 64;
const NEW_ADMIN_NAME = "Administrator";

export type RecoveryResult =
  | { ok: true; email: string; replaced: number }
  | { ok: false; code: "rate_limited"; retryAfterSeconds: number }
  /** Wrong secret, recovery not configured, IP not allowed, or the email belongs to a customer. */
  | { ok: false; code: "denied" };

/** Constant-time comparison (hashing first makes the lengths equal). */
export function recoverySecretMatches(candidate: string): boolean {
  const configured = env().ADMIN_RECOVERY_SECRET;
  if (!configured || configured.length < MIN_SECRET_LENGTH) return false;
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(digest(candidate), digest(configured));
}

function ipAllowed(ip: string): boolean {
  const list = env().ADMIN_RECOVERY_ALLOWED_IPS?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
  return list.length === 0 || (ip !== "unknown" && list.includes(ip));
}

export async function recoverAdmin(input: { secret: string; email: string; password: string }, ctx: RequestContext): Promise<RecoveryResult> {
  // Every attempt counts, before the secret is checked. The global window holds even when the client IP is unknown.
  const checks: [string, RateLimitRule][] = [["recovery:global", RATE_LIMITS.adminRecoveryGlobal]];
  if (ctx.ip && ctx.ip !== "unknown") checks.unshift([`recovery:ip:${ctx.ip}`, RATE_LIMITS.adminRecoveryPerIp]);
  for (const [key, rule] of checks) {
    const r = await hitRateLimit(key, rule);
    if (!r.allowed) return { ok: false, code: "rate_limited", retryAfterSeconds: r.retryAfterSeconds };
  }

  const ip = ctx.ip !== "unknown" ? ctx.ip : undefined;
  const deny = async (reason: string): Promise<RecoveryResult> => {
    await audit(null, "admin.recovery", null, false, { reason, ip }, "Emergency admin recovery refused");
    return { ok: false, code: "denied" };
  };
  if (!ipAllowed(ctx.ip)) return deny("ip_not_allowed");
  if (!recoverySecretMatches(input.secret)) return deny("invalid_secret");

  const existing = await db().user.findUnique({ where: { email: input.email }, select: { id: true, role: true, deletedAt: true } });
  if (existing && (existing.role !== "ADMIN" || existing.deletedAt)) return deny("email_belongs_to_customer");

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  let replaced = 0;
  let adminId = existing?.id ?? "";
  try {
    await db().$transaction(async (tx) => {
      const oldAdmins = await tx.user.findMany({ where: { role: "ADMIN", id: { not: existing?.id ?? "" } }, select: { id: true } });
      const oldIds = oldAdmins.map((u) => u.id);
      replaced = oldIds.length;
      if (oldIds.length) {
        await tx.user.updateMany({
          where: { id: { in: oldIds } },
          data: {
            role: "USER",
            status: "SUSPENDED",
            suspensionReason: "Administrator replaced by emergency recovery",
            suspendedById: null,
            suspendedAt: now,
            passwordChangedAt: now,
          },
        });
      }

      if (existing) {
        await tx.user.update({ where: { id: existing.id }, data: { passwordHash, passwordChangedAt: now, status: "ACTIVE" } });
      } else {
        const created = await tx.user.create({
          data: {
            name: NEW_ADMIN_NAME,
            email: input.email,
            passwordHash,
            role: "ADMIN",
            emailVerifiedAt: now,
            passwordChangedAt: now,
            wallet: { create: { currency: platformCurrency().code } },
          },
          select: { id: true },
        });
        adminId = created.id;
      }

      // Every admin session ends, and pending reset / email-change links stop working.
      const affected = [...oldIds, adminId];
      await tx.session.deleteMany({ where: { userId: { in: affected } } });
      await tx.authToken.updateMany({ where: { userId: { in: affected }, usedAt: null }, data: { usedAt: now } });

      await auditInTx(tx, null, {
        action: "admin.recovery",
        target: { type: "user", id: adminId },
        success: true,
        metadata: { replacedAdmins: oldIds, created: !existing, ip },
        description: `Emergency admin recovery: ${input.email} is now the only administrator (${oldIds.length} replaced)`,
      });
    });
  } catch (error) {
    // Someone registered this email between the check and the insert: it's a customer account now.
    if (isUniqueViolation(error)) return deny("email_belongs_to_customer");
    throw error;
  }

  // A lockout from earlier failed logins shouldn't block the first login with the new credentials.
  await resetRateLimit(`login:email:${input.email}`);
  return { ok: true, email: input.email, replaced };
}
