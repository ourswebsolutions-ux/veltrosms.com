import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";

export type RequestContext = { ip: string; userAgent: string | null };

/**
 * Client IP and user agent for rate limiting and the session list.
 * X-Forwarded-For is only trusted when TRUST_PROXY=true (it's spoofable otherwise).
 */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  let ip = "unknown";
  if (env().TRUST_PROXY) {
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || ip;
  }
  return { ip: ip.slice(0, 64), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}
