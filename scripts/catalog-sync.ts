/** Refresh countries, services and prices from the provider now. Usage: npm run catalog:sync */
import "./_env";
import { db } from "@/server/db";
import { getProvider } from "@/server/providers/registry";
import { syncCatalog } from "@/server/services/catalog.service";

async function main() {
  const provider = getProvider();
  if (!provider.capabilities.has("catalog")) {
    console.error("No provider configured: set SMS_PROVIDER=grizzly and GRIZZLY_API_KEY in .env.local.");
    process.exitCode = 1;
    return;
  }
  const started = Date.now();
  const report = await syncCatalog();
  if (!report) console.log("Another sync is already running; nothing to do.");
  else console.log(`Synced ${report.countries} countries, ${report.services} services, ${report.prices} prices (${report.deactivated} deactivated) in ${Date.now() - started} ms.`);
}

main()
  .catch((error) => {
    console.error("Catalog sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
