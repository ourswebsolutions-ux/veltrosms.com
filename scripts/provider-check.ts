/**
 * Operator check: provider connectivity, our provider balance and catalog
 * size. Read-only — never buys anything.   npm run provider:check
 */
import "./_env";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getCatalogStatus } from "@/server/services/catalog.service";
import { checkProviderHealth } from "@/server/services/provider-health.service";

async function main() {
  const health = await checkProviderHealth();
  console.log(`Provider:        ${health.provider}${health.configured ? "" : " (not configured — set SMS_PROVIDER and GRIZZLY_API_KEY)"}`);
  console.log(`Reachable:       ${health.reachable ? "yes" : `no (${health.errorCategory})`}`);
  if (health.balance !== null) {
    console.log(`Provider balance: ${formatMoney(health.balance, env().PROVIDER_CURRENCY)}${health.balance === 0 ? "  ⚠ purchases will be refused until the provider account is topped up" : ""}`);
  }
  console.log(`Failures (15 min): ${health.recentFailures}`);
  const [countries, services, prices, catalog] = await Promise.all([
    db().country.count({ where: { providerActive: true } }),
    db().service.count({ where: { providerActive: true } }),
    db().price.count({ where: { isActive: true } }),
    getCatalogStatus(),
  ]);
  console.log(`Catalog:         ${countries} countries, ${services} services, ${prices} active offers (synced ${catalog.lastSuccessAt ?? "never"})`);
  if (catalog.lastError) console.log(`Last sync error: ${catalog.lastError}`);
  if (!health.reachable) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Check failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
