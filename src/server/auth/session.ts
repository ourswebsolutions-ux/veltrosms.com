import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, isDatabaseConfigured } from "@/server/db";
import { env } from "@/server/env";
import { generateToken, hashToken } from "./tokens";

export type Role = "user" | "admin";

/** What the rest of the app knows about the signed-in user. No secrets. */
export type SessionUser = {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

const PERSISTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // "remember me"
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // browser-session cookie
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Secure, host-only cookie over HTTPS; plain name for http://localhost. */
function cookieConfig() {
  const secure = env().APP_URL.startsWith("https://");
  return { name: secure ? "__Host-rocksms_session" : "rocksms_session", secure };
}

export function sessionCookieName(): string {
  return cookieConfig().name;
}

/* ------------------------------------------------------------ lifecycle -- */

export async function createSession(
  userId: string,
  opts: { persistent: boolean; ip?: string | null; userAgent?: string | null; createdAt?: Date },
): Promise<{ token: string; expiresAt: Date; persistent: boolean }> {
  const token = generateToken();
  const createdAt = opts.createdAt ?? new Date();
  const expiresAt = new Date(createdAt.getTime() + (opts.persistent ? PERSISTENT_TTL_MS : SESSION_TTL_MS));
  await db().session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      persistent: opts.persistent,
      ip: opts.ip && opts.ip !== "unknown" ? opts.ip.slice(0, 64) : null,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      createdAt,
      lastUsedAt: createdAt,
      expiresAt,
    },
  });
  // Opportunistic cleanup of this user's expired sessions.
  await db().session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  return { token, expiresAt, persistent: opts.persistent };
}

/** Writes the session cookie. Only callable from server actions / route handlers. */
export async function setSessionCookie(session: { token: string; expiresAt: Date; persistent: boolean }) {
  const { name, secure } = cookieConfig();
  (await cookies()).set(name, session.token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    // Non-persistent sessions end with the browser; the server expiry still applies.
    ...(session.persistent ? { expires: session.expiresAt } : {}),
  });
}

export async function clearSessionCookie() {
  const { name, secure } = cookieConfig();
  (await cookies()).set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
}

/** Resolves a raw cookie token to a user, enforcing every validity rule. */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await db().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          passwordChangedAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  const user = session.user;
  // Disabled accounts, and sessions older than the last password change, are
  // rejected even if the cookie is still present. (Email confirmation is not required.)
  if (user.status !== "ACTIVE") return null;
  if (session.createdAt < user.passwordChangedAt) return null;

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db().session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  }
  return {
    id: user.id,
    sessionId: session.id,
    name: user.name,
    email: user.email,
    role: user.role === "ADMIN" ? "admin" : "user",
    createdAt: user.createdAt.toISOString(),
  };
}

/** The signed-in user for this request (cached per request), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token || !isDatabaseConfigured()) return null;
  try {
    return await validateSessionToken(token);
  } catch (error) {
    console.error("[auth] session lookup failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
});

/**
 * For protected pages and actions. Redirects to login (preserving where the
 * user was going) when there is no valid session.
 */
export async function requireUser(returnTo = "/profile"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/* ------------------------------------------------------------ revocation -- */

export async function deleteSessionByToken(token: string): Promise<void> {
  await db().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Current cookie's raw token, if any (used by logout). */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function deleteUserSessions(userId: string, opts: { except?: string } = {}): Promise<number> {
  const { count } = await db().session.deleteMany({
    where: { userId, ...(opts.except ? { id: { not: opts.except } } : {}) },
  });
  return count;
}

/** Revokes one of the user's sessions (scoped to the user: another user's id matches nothing). */
export async function deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
  const { count } = await db().session.deleteMany({ where: { id: sessionId, userId } });
  return count > 0;
}

export type SessionInfo = {
  id: string;
  current: boolean;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
};

export async function listUserSessions(userId: string, currentId: string): Promise<SessionInfo[]> {
  const rows = await db().session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
  });
  return rows.map((s) => ({
    id: s.id,
    current: s.id === currentId,
    userAgent: s.userAgent,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
  }));
}
