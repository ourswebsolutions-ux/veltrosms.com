import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { GrizzlyProvider } from "./grizzly/grizzly-provider";
import type { ProviderRequestLog, SmsProvider } from "./types";
import { UnconfiguredProvider } from "./unconfigured-provider";

let instance: SmsProvider | undefined;
let override: SmsProvider | undefined;

/**
 * Persists every provider call attempt (never blocks or fails the caller) and
 * writes one structured line for failures. Only safe metadata: no API key,
 * and response bodies only for failures (truncated by the HTTP client).
 */
function logRequest(entry: ProviderRequestLog) {
  if (!entry.success) {
    console.warn(
      JSON.stringify({
        level: "warn",
        source: "provider",
        provider: entry.provider,
        action: entry.action,
        orderId: entry.orderId,
        providerRef: entry.providerRef,
        category: entry.errorCategory,
        code: entry.errorCode,
        http: entry.httpStatus,
        ms: entry.durationMs,
        attempt: entry.attempt,
      }),
    );
  }
  db()
    .providerRequest.create({
      data: {
        provider: entry.provider,
        action: entry.action,
        orderId: entry.orderId ?? null,
        userId: entry.userId ?? null,
        providerRef: entry.providerRef ?? null,
        params: entry.params,
        success: entry.success,
        errorCategory: entry.errorCategory,
        errorCode: entry.errorCode,
        response: entry.response,
        httpStatus: entry.httpStatus,
        durationMs: entry.durationMs,
        attempt: entry.attempt,
      },
    })
    .catch((error: unknown) =>
      console.error("[provider] failed to log request:", error instanceof Error ? error.message : "unknown error"),
    );
}

/**
 * The active provider adapter. This is the only place that knows which
 * concrete provider is in use; add new adapters as cases here.
 */
export function getProvider(): SmsProvider {
  if (override) return override;
  if (instance) return instance;
  const e = env();
  instance =
    e.SMS_PROVIDER === "grizzly" && e.GRIZZLY_API_KEY
      ? new GrizzlyProvider(
          { apiUrl: e.GRIZZLY_API_URL, apiKey: e.GRIZZLY_API_KEY, maxRequestsPerSecond: e.PROVIDER_MAX_RPS },
          logRequest,
        )
      : new UnconfiguredProvider();
  return instance;
}

/** Tests only: swap in a provider implementation. */
export function setProviderForTesting(provider: SmsProvider | undefined) {
  override = provider;
}
