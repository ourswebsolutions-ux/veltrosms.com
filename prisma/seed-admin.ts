/**
 * Admin seeder — creates (or repairs) the administrator account.
 * Safe to run in any environment and as often as you like.
 *
 *   npm run db:seed:admin
 *
 * Configuration (server environment / .env.local — never commit a password):
 *   ADMIN_EMAIL     administrator email            (default: zh613781@gmail.com)
 *   ADMIN_NAME      display name                   (default: Administrator)
 *   ADMIN_PASSWORD  optional initial password. If unset, a single-use
 *                   password-setup link is emailed to ADMIN_EMAIL instead.
 *                   Only its scrypt hash is stored; remove it afterwards.
 *   ADMIN_RESET_PASSWORD=true  also replace the password of an existing
 *                   admin with ADMIN_PASSWORD (otherwise it is never touched).
 *
 * Existing account: made ADMIN, ACTIVE and email-verified if it isn't.
 * Missing account: created as ADMIN with an empty wallet.
 */
import "../scripts/_env";
import { AdminSetupError, ensureAdmin } from "@/server/admin/setup";
import { db } from "@/server/db";

const DEFAULT_ADMIN_EMAIL = "zh613781@gmail.com";

async function main() {
  const result = await ensureAdmin({
    email: process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL,
    name: process.env.ADMIN_NAME?.trim() || "Administrator",
    password: process.env.ADMIN_PASSWORD,
    resetPassword: process.env.ADMIN_RESET_PASSWORD === "true",
  });

  if (result.created) {
    console.log(`✔ Administrator ${result.email} created.`);
  } else if (result.repaired.length) {
    console.log(`✔ Administrator ${result.email} updated: ${result.repaired.join(", ")}.`);
  } else {
    console.log(`✔ ${result.email} is already an active administrator. Nothing changed.`);
  }
  if (result.password === "set_from_input") {
    console.log("  Password set from ADMIN_PASSWORD (only its hash is stored). Remove ADMIN_PASSWORD from the environment now.");
  }
  if (result.password === "setup_link_emailed") {
    console.log(`  A password-setup link was emailed to ${result.email} (valid 60 minutes).`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof AdminSetupError ? `✖ ${error.message}` : `✖ Admin seeding failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
