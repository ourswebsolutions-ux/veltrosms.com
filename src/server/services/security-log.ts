import "server-only";
import { db, type Prisma } from "@/server/db";

/**
 * Security events (logins, failed logins, credential changes) recorded in
 * `system_logs` for the admin log viewer. Never includes passwords, tokens or
 * full email addresses of unknown accounts. Logging failures never break the
 * flow that triggered them.
 */

export type SecurityEvent =
  | "login_success"
  | "login_failed"
  | "login_blocked"
  | "logout"
  | "password_changed"
  | "password_reset"
  | "email_change_requested"
  | "email_changed"
  | "sessions_revoked";

const WARN: SecurityEvent[] = ["login_failed", "login_blocked"];

/** "someone@example.com" → "so***@example.com" */
export function maskAddress(email: string): string {
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 2)}***@${domain}` : "***";
}

export async function logSecurityEvent(
  event: SecurityEvent,
  data: { userId?: string | null; ip?: string | null; email?: string; detail?: string } = {},
): Promise<void> {
  try {
    const context: Prisma.InputJsonObject = {
      ...(data.ip && data.ip !== "unknown" ? { ip: data.ip.slice(0, 64) } : {}),
      ...(data.email ? { email: maskAddress(data.email) } : {}),
      ...(data.detail ? { detail: data.detail.slice(0, 120) } : {}),
    };
    await db().systemLog.create({
      data: { level: WARN.includes(event) ? "WARN" : "INFO", source: "auth", message: event, context, userId: data.userId ?? null },
    });
  } catch (error) {
    console.error("[security-log] write failed:", error instanceof Error ? error.message : "unknown error");
  }
}
