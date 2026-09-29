import "server-only";
import { db } from "@/server/db";
import { getProvider } from "@/server/providers/registry";
import { ProviderError, type ProviderErrorCode } from "@/server/providers/types";

/**
 * Operational view of the provider connection. The provider balance is our
 * account's money at the provider — for monitoring/admin only, never shown
 * to customers.
 */

const BALANCE_TTL_MS = 30_000;
let cached: { at: number; value: number } | undefined;

/** Provider account balance (minor units, provider currency), cached briefly. */
export async function getProviderBalance(opts: { fresh?: boolean } = {}): Promise<number> {
  if (!opts.fresh && cached && Date.now() - cached.at < BALANCE_TTL_MS) return cached.value;
  const value = await getProvider().getBalance();
  cached = { at: Date.now(), value };
  return value;
}

/** Forget the cached balance (after a purchase changes it). */
export function invalidateProviderBalance() {
  cached = undefined;
}

export type ProviderHealth = {
  provider: string;
  configured: boolean;
  reachable: boolean;
  errorCategory: ProviderErrorCode | null;
  balance: number | null;
  recentFailures: number;
};

export async function checkProviderHealth(): Promise<ProviderHealth> {
  const provider = getProvider();
  const recentFailures = await db()
    .providerRequest.count({ where: { success: false, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } })
    .catch(() => 0);
  if (!provider.capabilities.has("balance")) {
    return { provider: provider.id, configured: false, reachable: false, errorCategory: "NOT_CONFIGURED", balance: null, recentFailures };
  }
  try {
    const balance = await getProviderBalance({ fresh: true });
    return { provider: provider.id, configured: true, reachable: true, errorCategory: null, balance, recentFailures };
  } catch (error) {
    const category = error instanceof ProviderError ? error.code : "UNAVAILABLE";
    return { provider: provider.id, configured: true, reachable: false, errorCategory: category, balance: null, recentFailures };
  }
}
