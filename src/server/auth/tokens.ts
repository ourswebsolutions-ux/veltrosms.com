import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL-safe. Sent to the user; never stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What we store: a SHA-256 of the token (fast is fine — tokens are high-entropy). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
