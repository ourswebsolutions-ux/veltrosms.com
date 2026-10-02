import "server-only";
import { randomBytes } from "node:crypto";
import { hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db";

/**
 * Personal API keys. The full key is returned once at creation; only its
 * SHA-256 hash and last 4 characters are stored.
 */
const PREFIX = "rk_live_";

export async function createApiKey(userId: string): Promise<{ key: string; hint: string }> {
  const key = PREFIX + randomBytes(24).toString("base64url");
  const hint = `${PREFIX}…${key.slice(-4)}`;
  await db().user.update({
    where: { id: userId },
    data: { apiKeyHash: hashToken(key), apiKeyHint: hint, apiKeyCreatedAt: new Date() },
  });
  return { key, hint };
}

export async function revokeApiKey(userId: string): Promise<void> {
  await db().user.update({ where: { id: userId }, data: { apiKeyHash: null, apiKeyHint: null, apiKeyCreatedAt: null } });
}

/** Resolves a presented key to an active, verified user. */
export async function userForApiKey(key: string) {
  if (!key.startsWith(PREFIX) || key.length > 100) return null;
  const user = await db().user.findUnique({
    where: { apiKeyHash: hashToken(key) },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}
