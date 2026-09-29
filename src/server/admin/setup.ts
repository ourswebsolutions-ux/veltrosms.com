import "server-only";
import { randomBytes } from "node:crypto";
import { emailSchema, nameSchema, passwordProblem } from "@/lib/validation/auth";
import { hashPassword } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { passwordResetEmail } from "@/server/email/templates";
import { env } from "@/server/env";
import { platformCurrency } from "@/server/services/currency";
import { audit } from "./audit";

/**
 * Creates or repairs an administrator account (used by the admin seeder and
 * `npm run admin:role -- --create`). Idempotent: running it again never
 * creates a duplicate and never overwrites an existing password unless asked.
 *
 * Passwords never live in source code. Either one is supplied (from the
 * environment — only its scrypt hash is stored), or the account gets an
 * unusable random password and a single-use setup link is emailed.
 */

const SETUP_LINK_MINUTES = 60;

export type EnsureAdminResult = {
  email: string;
  created: boolean;
  /** Role/status/verification were fixed on an existing account. */
  repaired: string[];
  password: "set_from_input" | "setup_link_emailed" | "unchanged";
};

export class AdminSetupError extends Error {}

async function emailSetupLink(userId: string, email: string, name: string) {
  const token = generateToken();
  await db().authToken.create({
    data: { userId, purpose: "PASSWORD_RESET", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SETUP_LINK_MINUTES * 60_000) },
  });
  const url = `${env().APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(passwordResetEmail(email, name, url, SETUP_LINK_MINUTES));
}

export async function ensureAdmin(input: { email: string; name?: string; password?: string; resetPassword?: boolean }): Promise<EnsureAdminResult> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) throw new AdminSetupError("Invalid admin email address.");
  const name = nameSchema.safeParse(input.name ?? "Administrator");
  if (!name.success) throw new AdminSetupError("Invalid admin name.");
  const password = input.password || undefined;
  if (password) {
    const problem = passwordProblem(password, { email: email.data, name: name.data });
    if (problem) throw new AdminSetupError(`Admin password is not strong enough: ${problem}`);
  }

  const existing = await db().user.findUnique({ where: { email: email.data } });

  if (!existing) {
    const user = await db().user.create({
      data: {
        name: name.data,
        email: email.data,
        passwordHash: await hashPassword(password ?? randomBytes(32).toString("base64url")),
        emailVerifiedAt: new Date(),
        role: "ADMIN",
        wallet: { create: { currency: platformCurrency().code } },
      },
      select: { id: true },
    });
    await audit(null, "user.admin_created", { type: "user", id: user.id }, true, { via: "setup", passwordFrom: password ? "input" : "setup_link" }, `Administrator ${email.data} created by setup`);
    if (!password) await emailSetupLink(user.id, email.data, name.data);
    return { email: email.data, created: true, repaired: [], password: password ? "set_from_input" : "setup_link_emailed" };
  }

  if (existing.deletedAt) throw new AdminSetupError("That account was deleted and can't be made an administrator.");

  const repaired: string[] = [];
  const data: { role?: "ADMIN"; status?: "ACTIVE"; emailVerifiedAt?: Date; passwordHash?: string; passwordChangedAt?: Date } = {};
  if (existing.role !== "ADMIN") {
    data.role = "ADMIN";
    repaired.push("role → admin");
  }
  if (existing.status !== "ACTIVE") {
    data.status = "ACTIVE";
    repaired.push("status → active");
  }
  if (!existing.emailVerifiedAt) {
    data.emailVerifiedAt = new Date();
    repaired.push("email → verified");
  }
  let passwordOutcome: EnsureAdminResult["password"] = "unchanged";
  if (input.resetPassword) {
    if (!password) throw new AdminSetupError("Resetting the password needs a password (ADMIN_PASSWORD).");
    data.passwordHash = await hashPassword(password);
    data.passwordChangedAt = new Date(); // other sessions of this account end
    passwordOutcome = "set_from_input";
    repaired.push("password reset");
  }
  if (repaired.length) {
    await db().user.update({ where: { id: existing.id }, data });
    await audit(null, "user.admin_repaired", { type: "user", id: existing.id }, true, { via: "setup", changes: repaired }, `Administrator ${email.data} updated by setup: ${repaired.join(", ")}`);
  }
  return { email: email.data, created: false, repaired, password: passwordOutcome };
}
