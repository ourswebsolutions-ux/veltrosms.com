import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { formatRetry, hitRateLimit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { sessionCookieName, validateSessionToken } from "@/server/auth/session";
import { hashToken } from "@/server/auth/tokens";
import { env } from "@/server/env";
import type { AdminActor } from "@/server/admin/guard";
import { userForApiKey } from "@/server/services/api-key.service";

/**
 * Shared plumbing for JSON route handlers: authentication (API key or
 * session cookie), CSRF protection for cookie-authenticated writes, uniform
 * error bodies and a catch-all so internals never leak.
 */

export type ApiUser = { id: string; via: "api_key" | "session" };

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": "no-store", ...init.headers },
  });
}

export function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: { code, message, ...extra } }, { status });
}

/** Resolves the caller: Bearer API key first, then the session cookie. */
async function authenticate(req: NextRequest): Promise<ApiUser | NextResponse> {
  const header = req.headers.get("authorization");
  if (header) {
    const key = /^Bearer\s+(\S+)$/i.exec(header)?.[1];
    if (!key) return apiError(401, "UNAUTHORIZED", "Use 'Authorization: Bearer <api key>'.");
    const limit = await hitRateLimit(`api:key:${hashToken(key).slice(0, 32)}`, RATE_LIMITS.apiPerKey);
    if (!limit.allowed) {
      return apiError(429, "RATE_LIMITED", `Too many requests. Retry in ${formatRetry(limit.retryAfterSeconds)}.`, {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const user = await userForApiKey(key);
    if (!user) return apiError(401, "UNAUTHORIZED", "Invalid or revoked API key.");
    return { id: user.id, via: "api_key" };
  }

  // Session cookie, read from this request (no ambient request context needed).
  const token = req.cookies.get(sessionCookieName())?.value;
  const user = token ? await validateSessionToken(token) : null;
  if (!user) return apiError(401, "UNAUTHORIZED", "Authentication required.");

  // Cookie-authenticated writes must be same-origin JSON (CSRF protection;
  // cross-site forms can't send application/json without a CORS preflight).
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const expected = new URL(env().APP_URL).origin;
    const sameOrigin = origin === expected || origin === req.nextUrl.origin;
    if (!sameOrigin || !req.headers.get("content-type")?.includes("application/json")) {
      return apiError(403, "FORBIDDEN", "Cross-site request rejected.");
    }
  }
  return { id: user.id, via: "session" };
}

type Handler<P> = (req: NextRequest, ctx: { user: ApiUser; params: P }) => Promise<Response>;

/** Wraps a handler with authentication and error handling. */
export function withAuth<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const auth = await authenticate(req);
      if (auth instanceof NextResponse) return auth;
      return await handler(req, { user: auth, params: await ctx.params });
    } catch (error) {
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} failed:`, error instanceof Error ? error.message : "unknown error");
      return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
}

/**
 * Admin JSON endpoints: session cookie only (API keys are refused so a leaked
 * key can never reach admin functions), admin role re-read from the database,
 * same-origin JSON for writes (CSRF). Non-admins get 403, anonymous 401.
 */
export function withAdmin<P = Record<string, never>>(handler: (req: NextRequest, ctx: { admin: AdminActor; params: P }) => Promise<Response>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      if (req.headers.get("authorization")) return apiError(403, "FORBIDDEN", "Admin endpoints don't accept API keys.");
      const token = req.cookies.get(sessionCookieName())?.value;
      const user = token ? await validateSessionToken(token) : null;
      if (!user) return apiError(401, "UNAUTHORIZED", "Authentication required.");
      if (user.role !== "admin") return apiError(403, "FORBIDDEN", "Administrator access required.");
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        const expected = new URL(env().APP_URL).origin;
        const sameOrigin = origin === expected || origin === req.nextUrl.origin;
        if (!sameOrigin || !req.headers.get("content-type")?.includes("application/json")) {
          return apiError(403, "FORBIDDEN", "Cross-site request rejected.");
        }
        const limit = await hitRateLimit(`admin:actions:${user.id}`, RATE_LIMITS.adminActionsPerAdmin);
        if (!limit.allowed) return apiError(429, "RATE_LIMITED", `Too many admin actions. Retry in ${formatRetry(limit.retryAfterSeconds)}.`);
      }
      const forwarded = env().TRUST_PROXY ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
      const admin: AdminActor = { id: user.id, email: user.email, name: user.name, sessionId: user.sessionId, ip: forwarded };
      return await handler(req, { admin, params: await ctx.params });
    } catch (error) {
      console.error(`[admin-api] ${req.method} ${req.nextUrl.pathname} failed:`, error instanceof Error ? error.message : "unknown error");
      return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
}

/** Reads a JSON body (bounded), returning null when it isn't valid JSON. */
export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 10_000) return null;
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

export const HTTP_FOR_ORDER_ERROR: Record<string, number> = {
  INVALID: 400,
  NOT_FOUND: 404,
  NOT_ALLOWED: 409,
  PRICE_CHANGED: 409,
  INSUFFICIENT_FUNDS: 402,
  NO_NUMBERS: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  PROVIDER_ERROR: 502,
};
