import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/authorization";
import { getRequestContext } from "@/server/auth/request";

/**
 * Admin access, always decided on the server from the session's user as
 * stored in the database (role and status are re-read on every request).
 * Nothing the browser sends — role flags, hidden fields, URLs — counts.
 */

export type AdminActor = Pick<SessionUser, "id" | "email" | "name" | "sessionId"> & {
  /** Client IP for the audit log (only when TRUST_PROXY makes it trustworthy). */
  ip?: string;
};

const toActor = (u: SessionUser, ip?: string): AdminActor => ({ id: u.id, email: u.email, name: u.name, sessionId: u.sessionId, ip });

/** For admin pages: anonymous → login; signed in but not admin → 404 (the area isn't advertised). */
export async function requireAdminPage(returnTo = "/admin"): Promise<AdminActor> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!can(user, "admin:access")) notFound();
  return toActor(user);
}

/** For admin server actions: the acting admin, or null (caller refuses). */
export async function getAdminActor(): Promise<AdminActor | null> {
  const user = await getCurrentUser();
  if (!user || !can(user, "admin:access")) return null;
  const { ip } = await getRequestContext();
  return toActor(user, ip);
}
