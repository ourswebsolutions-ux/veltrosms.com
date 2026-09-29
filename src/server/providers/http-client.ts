import "server-only";
import { ProviderError, type ProviderErrorCode, type ProviderRequestLog } from "./types";

/**
 * Server-side HTTP client for query-string style provider APIs.
 *
 *  - The API key is added here and never leaves this module (not logged,
 *    not returned, not included in errors).
 *  - Per-request timeout; in-process pacing so we never exceed the configured
 *    requests/second no matter how many browsers are polling.
 *  - Retries (with backoff) ONLY for calls marked safe — reads. Anything that
 *    can buy or change state is attempted exactly once.
 *  - Every attempt is reported to `log` with safe metadata only.
 */

export type CallOptions = {
  /** "safe" = idempotent read that may be retried; "once" = never retried. */
  retry: "safe" | "once";
  timeoutMs?: number;
  orderId?: string;
  userId?: string;
  providerRef?: string;
};

type Config = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  maxRequestsPerSecond: number;
  /** Maps a plain-text provider answer to an error code, or null if it isn't an error. */
  classify: (body: string) => { code: ProviderErrorCode; raw: string } | null;
  log: (entry: ProviderRequestLog) => void;
  fetchImpl?: typeof fetch;
  /** Test hook to avoid real waiting. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const LOGGED_RESPONSE_CHARS = 500;

export class ProviderHttpClient {
  private nextSlot = 0;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly config: Config) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Spaces requests evenly to stay under the provider's rate. */
  private async pace() {
    const spacing = 1000 / this.config.maxRequestsPerSecond;
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + spacing;
    if (slot > now) await this.sleep(slot - now);
  }

  async request(action: string, params: Record<string, string>, options: CallOptions): Promise<string> {
    const attempts = options.retry === "safe" ? MAX_RETRIES + 1 : 1;
    let lastError: ProviderError | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.attempt(action, params, options, attempt);
      } catch (error) {
        lastError = error instanceof ProviderError ? error : new ProviderError("UNAVAILABLE", "Provider request failed", this.config.provider);
        const transient = ["TIMEOUT", "UNAVAILABLE", "RATE_LIMITED"].includes(lastError.code);
        if (!transient || attempt === attempts) throw lastError;
        const backoff = lastError.retryAfterMs ?? 500 * 2 ** (attempt - 1);
        await this.sleep(Math.min(backoff, 10_000));
      }
    }
    throw lastError!;
  }

  private async attempt(action: string, params: Record<string, string>, options: CallOptions, attempt: number): Promise<string> {
    await this.pace();
    const url = new URL(this.config.baseUrl);
    url.searchParams.set("api_key", this.config.apiKey);
    url.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const started = Date.now();
    let status: number | null = null;
    let body: string | null = null;
    let failure: ProviderError | null = null;
    try {
      const res = await this.fetchImpl(url, {
        headers: { "User-Agent": "VirtuMSG/1.0", Accept: "application/json, text/plain" },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        cache: "no-store",
      });
      status = res.status;
      body = (await res.text()).trim();

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        failure = new ProviderError("RATE_LIMITED", "Provider rate limit reached", this.config.provider, {
          retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
        });
      } else if (res.status >= 500) {
        failure = new ProviderError("UNAVAILABLE", `Provider HTTP ${res.status}`, this.config.provider);
      } else if (/^\s*</.test(body)) {
        // An HTML page (proxy/maintenance) is never a valid API answer.
        failure = new ProviderError("UNAVAILABLE", "Provider returned an HTML page", this.config.provider);
      } else {
        const known = this.config.classify(body);
        if (known) failure = new ProviderError(known.code, known.raw, this.config.provider, { rawCode: known.raw });
        else if (!res.ok) failure = new ProviderError("BAD_REQUEST", `Provider HTTP ${res.status}`, this.config.provider);
      }
      if (failure) throw failure;
      return body;
    } catch (error) {
      if (error instanceof ProviderError) {
        failure = error;
      } else {
        const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        failure = new ProviderError(timeout ? "TIMEOUT" : "UNAVAILABLE", timeout ? "Provider timed out" : "Provider unreachable", this.config.provider);
      }
      throw failure;
    } finally {
      this.config.log({
        provider: this.config.provider,
        action,
        orderId: options.orderId,
        userId: options.userId,
        providerRef: options.providerRef,
        params, // api_key is added to the URL above, never to this object
        success: !failure,
        errorCategory: failure?.code ?? null,
        errorCode: failure?.rawCode ?? null,
        // Bodies can be large (catalog) or sensitive (numbers/codes): keep only failures.
        response: failure && body ? body.slice(0, LOGGED_RESPONSE_CHARS) : null,
        httpStatus: status,
        durationMs: Date.now() - started,
        attempt,
      });
    }
  }
}
