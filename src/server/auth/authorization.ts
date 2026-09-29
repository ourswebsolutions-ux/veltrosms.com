import "server-only";
import { forbidden } from "next/navigation";
import { requireUser, type Role, type SessionUser } from "./session";

/**
 * Role-based authorization. Always enforced on the server — UI checks are
 * only cosmetic. Add permissions here as features land (admin panel, etc.).
 */
export const PERMISSIONS = {
  "account:read": ["user", "admin"],
  "account:update": ["user", "admin"],
  "orders:create": ["user", "admin"],
  "admin:access": ["admin"],
  "admin:users:manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: Pick<SessionUser, "role"> | null | undefined, permission: Permission): boolean {
  return Boolean(user && (PERMISSIONS[permission] as readonly Role[]).includes(user.role));
}

/** Signed-in user with the permission, else redirect to login / 403. */
export async function requirePermission(permission: Permission, returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!can(user, permission)) forbidden();
  return user;
}
