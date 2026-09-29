/**
 * Staff tool: grant or remove administrator rights from the server shell
 * (later admins can also be managed in /admin → Users).
 *
 *   npm run admin:role -- --email you@example.com            # grant
 *   npm run admin:role -- --email you@example.com --revoke   # remove
 *   npm run admin:role -- --email you@example.com --create   # create the account if missing
 *
 * --create never takes a password on the command line. It uses
 * ADMIN_SETUP_PASSWORD from the environment if set (only its hash is stored),
 * otherwise it emails a single-use password-setup link. For a repeatable,
 * config-driven setup use the admin seeder instead: npm run db:seed:admin.
 */
import "./_env";
import { parseArgs } from "node:util";
import { audit } from "@/server/admin/audit";
import { AdminSetupError, ensureAdmin } from "@/server/admin/setup";
import { db } from "@/server/db";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, revoke: { type: "boolean", default: false }, create: { type: "boolean", default: false } },
  });
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run admin:role -- --email <email> [--create] [--revoke]");
    process.exitCode = 1;
    return;
  }

  if (values.create && !values.revoke) {
    const r = await ensureAdmin({ email, password: process.env.ADMIN_SETUP_PASSWORD });
    if (r.created) {
      console.log(
        r.password === "setup_link_emailed"
          ? `Created administrator ${email}. A password-setup link was emailed to that address (valid 60 minutes).`
          : `Created administrator ${email} with the password from ADMIN_SETUP_PASSWORD. Remove that variable now.`,
      );
    } else {
      console.log(r.repaired.length ? `${email} updated: ${r.repaired.join(", ")}.` : `${email} is already an active administrator.`);
    }
    return;
  }

  const user = await db().user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    console.error("No account with that email. Add --create to create it.");
    process.exitCode = 1;
    return;
  }
  const role = values.revoke ? "USER" : "ADMIN";
  if (user.role === role) {
    console.log(`Already ${role.toLowerCase()}.`);
    return;
  }
  await db().user.update({ where: { id: user.id }, data: { role } });
  await audit(null, "user.role", { type: "user", id: user.id }, true, { to: role.toLowerCase(), via: "cli" }, `${email} made ${role === "ADMIN" ? "an administrator" : "a regular user"} from the server shell`);
  console.log(`${email} is now ${role === "ADMIN" ? "an administrator" : "a regular user"}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof AdminSetupError ? error.message : `Failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
