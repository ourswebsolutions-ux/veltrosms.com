import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

const TABLES = [
  "audit_logs", "payment_events", "sms_messages", "transactions", "service_country_margins", "ready_made_orders", "ready_made_offers", "payments", "orders", "prices", "services", "countries", "wallets",
  "sessions", "auth_tokens", "rate_limits", "partner_applications", "provider_requests",
  "system_logs", "settings", "users",
];

/** Empties every table (test database only). */
export async function resetDatabase() {
  // Session variables must be set on the same connection as the truncates.
  await db().$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of TABLES) await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  });
}

let counter = 0;
/** A verified user with an (empty) wallet. */
export async function createUser(overrides: { email?: string; name?: string } = {}) {
  counter += 1;
  return db().user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user${counter}-${Date.now()}@example.test`,
      passwordHash: await hashPassword("Test-password-1234"),
      emailVerifiedAt: new Date(),
      wallet: { create: { currency: "USD" } },
    },
  });
}

export const USD = (units: number) => Math.round(units * 10_000);
