import "server-only";
import { db, isUniqueViolation } from "@/server/db";

/**
 * Fixed-window rate limiting stored in the database, so limits hold across
 * app instances and restarts.
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** Per email: brute-force protection on one account (also for unknown emails). */
  loginPerEmail: { limit: 5, windowSeconds: 15 * 60 },
  /** Per IP: credential stuffing across many accounts. */
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
  /** Emails we send (verification / reset) per address. */
  emailPerAddress: { limit: 3, windowSeconds: 60 * 60 },
  emailPerIp: { limit: 10, windowSeconds: 60 * 60 },
  passwordChangePerUser: { limit: 5, windowSeconds: 15 * 60 },
  /** Email-change requests per user (each sends two emails). */
  emailChangePerUser: { limit: 5, windowSeconds: 60 * 60 },
  /** Number purchases per user (abuse / runaway scripts). */
  purchasePerUser: { limit: 10, windowSeconds: 60 },
  /** Top-up payments created per user (each one calls the payment provider). */
  paymentCreatePerUser: { limit: 10, windowSeconds: 10 * 60 },
  /** Explicit "check payment now" requests per user (status polling is throttled separately). */
  paymentVerifyPerUser: { limit: 30, windowSeconds: 60 },
  /** Admin mutations per administrator (stops runaway scripts; far above manual use). */
  adminActionsPerAdmin: { limit: 120, windowSeconds: 60 },
  /** Public API calls per API key. */
  apiPerKey: { limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export async function hitRateLimit(key: string, rule: RateLimitRule, attempt = 0): Promise<RateLimitResult> {
  const now = new Date();
  const freshReset = new Date(now.getTime() + rule.windowSeconds * 1000);
  let row: { count: number; resetAt: Date };
  try {
    row = await db().$transaction(async (tx) => {
      const current = await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt: freshReset },
        update: { count: { increment: 1 } },
      });
      // Window elapsed: start a new one.
      if (current.resetAt <= now) {
        return tx.rateLimit.update({ where: { key }, data: { count: 1, resetAt: freshReset } });
      }
      return current;
    });
  } catch (error) {
    // Two first-hits raced on insert; the retry sees the existing row.
    if (isUniqueViolation(error) && attempt < 2) return hitRateLimit(key, rule, attempt + 1);
    throw error;
  }
  return {
    allowed: row.count <= rule.limit,
    remaining: Math.max(0, rule.limit - row.count),
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Clears a counter, e.g. the per-email login counter after a successful login. */
export async function resetRateLimit(key: string): Promise<void> {
  await db().rateLimit.deleteMany({ where: { key } });
}

/** Housekeeping: drop expired windows. */
export async function pruneRateLimits(): Promise<number> {
  const { count } = await db().rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}

export function formatRetry(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return seconds < 60 ? `${seconds} seconds` : minutes <= 1 ? "a minute" : `${minutes} minutes`;
}
