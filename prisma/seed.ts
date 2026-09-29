/**
 * Development seed. Creates ONE clearly labelled test account with a
 * development credit so purchases can be tried end-to-end.
 *
 * It deliberately does NOT create countries, services or prices: those only
 * ever come from the real provider (npm run catalog:sync).
 * Remove with: DELETE the user dev@rocksms.test (and its rows) or reset the DB.
 */
import "../scripts/_env";
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { platformCurrency } from "@/server/services/currency";
import { adjustWallet } from "@/server/services/wallet.service";

const EMAIL = "dev@rocksms.test";
// No password in source: set SEED_DEV_PASSWORD, or a random one is generated and printed once.
const PASSWORD = process.env.SEED_DEV_PASSWORD ?? randomBytes(12).toString("base64url");
const CREDIT = 5 * 10_000; // 5.00 in minor units

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database.");

  const user = await db().user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      name: "Development Tester",
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: new Date(),
      wallet: { create: { currency: platformCurrency().code } },
    },
  });
  // Idempotent: the fixed reference means re-running never credits twice.
  const { duplicate } = await adjustWallet({
    userId: user.id,
    amount: CREDIT,
    reference: "seed:dev-credit",
    description: "Development credit (seed data, not real money)",
    actor: "seed",
  });
  const shown = process.env.SEED_DEV_PASSWORD ? "(password from SEED_DEV_PASSWORD)" : PASSWORD;
  console.log(`Test account: ${EMAIL} / ${shown}${duplicate ? " (credit already applied)" : " — credited 5.00"}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
