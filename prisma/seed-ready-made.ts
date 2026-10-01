/**
 * Ready Made Accounts seeder — creates the default offer:
 * WhatsApp · All countries · active.
 *
 *   READY_MADE_DEFAULT_PRICE=2.50 npm run db:seed:ready-made
 *
 * Safe to run in any environment and as often as you like: if a WhatsApp /
 * All countries offer already exists it is left exactly as it is (price,
 * status and all). The price is required — there is no built-in default — and
 * is in the platform currency (PLATFORM_CURRENCY). Requires a catalog sync
 * first, so the WhatsApp service exists.
 */
import "../scripts/_env";
import { ensureDefaultReadyMadeOffer } from "@/server/admin/ready-made";
import { db } from "@/server/db";

async function main() {
  const price = process.env.READY_MADE_DEFAULT_PRICE?.trim();
  if (!price) {
    console.error("✖ Set READY_MADE_DEFAULT_PRICE (e.g. 2.50, in the platform currency). Nothing was changed.");
    process.exitCode = 1;
    return;
  }
  const r = await ensureDefaultReadyMadeOffer(price);
  const messages = {
    created: `✔ Created the default Ready Made offer: ${r.offer}.`,
    exists: `✔ ${r.offer} already exists. Nothing changed.`,
    no_service: "✖ No WhatsApp service in the catalog yet. Run npm run catalog:sync first. Nothing was changed.",
    invalid_price: "✖ READY_MADE_DEFAULT_PRICE must be a positive amount like 2.50. Nothing was changed.",
  } as const;
  console.log(messages[r.status]);
  if (r.status === "no_service" || r.status === "invalid_price") process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("✖ Seeding failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
