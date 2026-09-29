import "server-only";
import { z } from "zod";
import { ProviderHttpClient } from "../http-client";
import {
  ProviderError,
  type ActivationState,
  type CallContext,
  type ProviderActivation,
  type ProviderActiveActivation,
  type ProviderCapability,
  type ProviderCountry,
  type ProviderErrorCode,
  type ProviderInventory,
  type ProviderPrice,
  type ProviderPriceTier,
  type ProviderRequestLog,
  type ProviderService,
  type ProviderSms,
  type SmsProvider,
  type StatusChange,
} from "../types";

/**
 * Adapter for the upstream activation API documented at
 * https://grizzlysms.com/docs (sms-activate compatible):
 *   GET <base>?api_key=…&action=…  → plain-text or JSON.
 *
 * Verified against live responses (read-only endpoints):
 *   getCountries      → { "<id>": { id, eng, …, visible } }
 *   getServicesList   → { status, services: [{ code, name }] }
 *   getPrices         → { "<country>": { "<service>": { cost, count, retry } } }  (no filters; ~3.6 MB)
 *   getPricesV3       → per country: { price, count, providers: { id: { count, price[] } } } (service filter)
 *   getActiveActivations → null | [...]
 */

const PROVIDER_ID = "grizzly";

/** Documented plain-text error answers → our error categories. */
const TEXT_ERRORS: Record<string, ProviderErrorCode> = {
  BAD_KEY: "UNAUTHORIZED",
  NO_KEY: "UNAUTHORIZED",
  NO_BALANCE: "PROVIDER_NO_BALANCE",
  NO_NUMBERS: "NO_NUMBERS",
  SERVICE_UNAVAILABLE_REGION: "REGION_BLOCKED",
  NO_ACTIVATION: "NOT_FOUND",
  EARLY_CANCEL_DENIED: "EARLY_CANCEL",
  BAD_SERVICE: "BAD_REQUEST",
  BAD_STATUS: "BAD_REQUEST",
  BAD_ACTION: "BAD_REQUEST",
  WRONG_MAX_PRICE: "PRICE_TOO_LOW",
  ERROR_SQL: "UNAVAILABLE",
};

function classify(body: string): { code: ProviderErrorCode; raw: string } | null {
  const head = body.split(":")[0].trim();
  if (TEXT_ERRORS[head]) return { code: TEXT_ERRORS[head], raw: head };
  if (/prohibited for sale/i.test(body)) return { code: "SERVICE_BLOCKED", raw: "SERVICE_PROHIBITED" };
  return null;
}

/** Provider amount (e.g. 0.35, "1.527") → minor units, rounding sub-precision up. */
export function costToMinor(value: unknown): number {
  const s = String(value).trim();
  const m = /^(\d{1,9})(?:\.(\d+))?$/.exec(s);
  if (!m) throw new ProviderError("INVALID_RESPONSE", `Unexpected amount: ${s.slice(0, 20)}`, PROVIDER_ID);
  const [, int, frac = ""] = m;
  let minor = Number(int) * 10_000 + Number(frac.padEnd(4, "0").slice(0, 4));
  if (/[1-9]/.test(frac.slice(4))) minor += 1; // never under-state a cost
  return minor;
}

/** Seconds between two provider timestamps ("YYYY-MM-DD HH:MM:SS", same zone). */
function secondsBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from.replace(" ", "T") + "Z");
  const b = Date.parse(to.replace(" ", "T") + "Z");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 1000)) : null;
}

/* ------------------------------------------------------------- schemas -- */

const code = z.string().regex(/^[a-z0-9_]{1,32}$/i);
const countryCode = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{1,6}$/));
const amount = z.union([z.number(), z.string()]).refine((v) => /^\d{1,9}(\.\d+)?$/.test(String(v)), "amount");
const qty = z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().min(0));
const activationId = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{1,20}$/));
const phone = z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d{6,20}$/));

const CountryRow = z.object({
  id: countryCode,
  eng: z.string().trim().min(1).max(120).optional(),
  rus: z.string().trim().min(1).max(120).optional(),
  visible: z.union([z.number(), z.boolean()]).optional(),
});
const ServicesResponse = z.object({ services: z.array(z.unknown()) });
const ServiceRow = z.object({ code, name: z.string().trim().min(1).max(120) });
const PriceCell = z.object({ cost: amount, count: qty });
const InventoryCell = z.object({
  price: amount,
  count: qty,
  providers: z.record(z.string(), z.object({ count: qty, price: z.array(amount) })).optional(),
});
const NumberV2 = z.object({
  activationId,
  phoneNumber: phone,
  activationCost: amount.optional(),
  canGetAnotherSms: z.union([z.string(), z.number(), z.boolean()]).optional(),
  activationTime: z.string().optional(),
  activationCancel: z.string().optional(),
  activationEnd: z.string().optional(),
});
const ActiveRow = z.object({
  activationId,
  phoneNumber: phone,
  serviceCode: code,
  countryCode,
  activationCost: amount.optional(),
});
const StatusV2 = z.object({
  sms: z.object({ dateTime: z.string().optional(), code: z.union([z.string(), z.number()]).optional(), text: z.string().optional() }).nullish(),
});

function parseJson(body: string, action: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", `Unexpected ${action} response`, PROVIDER_ID);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validates each row; drops bad ones (and says how many) instead of trusting them. */
function validRows<T>(rows: unknown[], schema: z.ZodType<T>, what: string): T[] {
  const out: T[] = [];
  for (const row of rows) {
    const r = schema.safeParse(row);
    if (r.success) out.push(r.data);
  }
  if (out.length < rows.length) console.warn(`[provider:grizzly] skipped ${rows.length - out.length} invalid ${what} row(s)`);
  return out;
}

/* ------------------------------------------------------------- adapter -- */

export class GrizzlyProvider implements SmsProvider {
  readonly id = PROVIDER_ID;
  readonly capabilities = new Set<ProviderCapability>(["balance", "catalog", "prices", "purchase", "status", "cancel"]);
  private readonly http: ProviderHttpClient;

  constructor(
    config: { apiUrl: string; apiKey: string; maxRequestsPerSecond?: number },
    log: (entry: ProviderRequestLog) => void = () => {},
    fetchImpl?: typeof fetch,
    sleep?: (ms: number) => Promise<void>,
  ) {
    this.http = new ProviderHttpClient({
      provider: PROVIDER_ID,
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
      maxRequestsPerSecond: config.maxRequestsPerSecond ?? 8,
      classify,
      log,
      fetchImpl,
      sleep,
    });
  }

  /* ---------------------------------------------------------------- reads -- */

  async getBalance(): Promise<number> {
    const body = await this.http.request("getBalance", {}, { retry: "safe" });
    const m = /^ACCESS_BALANCE:(.+)$/.exec(body);
    if (!m) throw new ProviderError("INVALID_RESPONSE", "Unexpected balance response", PROVIDER_ID);
    return costToMinor(m[1]);
  }

  async getCountries(): Promise<ProviderCountry[]> {
    const data = parseJson(await this.http.request("getCountries", {}, { retry: "safe" }), "getCountries");
    if (!isRecord(data) && !Array.isArray(data)) throw new ProviderError("INVALID_RESPONSE", "Countries are not a list", PROVIDER_ID);
    return validRows(Array.isArray(data) ? data : Object.values(data), CountryRow, "country")
      .filter((r) => r.eng || r.rus)
      .map((r) => ({ providerCode: r.id, name: (r.eng ?? r.rus)!, visible: r.visible === undefined ? true : Boolean(r.visible) }));
  }

  async getServices(): Promise<ProviderService[]> {
    const parsed = ServicesResponse.safeParse(parseJson(await this.http.request("getServicesList", {}, { retry: "safe" }), "getServicesList"));
    if (!parsed.success) throw new ProviderError("INVALID_RESPONSE", "Services list missing", PROVIDER_ID);
    return validRows(parsed.data.services, ServiceRow, "service").map((s) => ({ providerCode: s.code, name: s.name }));
  }

  async getPrices(): Promise<ProviderPrice[]> {
    // Only the unfiltered call is supported for a full list (a service-only filter answers NO_KEY).
    const data = parseJson(await this.http.request("getPrices", {}, { retry: "safe", timeoutMs: 120_000 }), "getPrices");
    if (!isRecord(data)) throw new ProviderError("INVALID_RESPONSE", "Prices are not an object", PROVIDER_ID);
    const out: ProviderPrice[] = [];
    let skipped = 0;
    for (const [country, services] of Object.entries(data)) {
      if (!/^\d{1,6}$/.test(country) || !isRecord(services)) continue;
      for (const [service, cell] of Object.entries(services)) {
        const r = PriceCell.safeParse(cell);
        if (!r.success || !code.safeParse(service).success) {
          skipped++;
          continue;
        }
        out.push({ countryCode: country, serviceCode: service, cost: costToMinor(r.data.cost), count: r.data.count });
      }
    }
    if (skipped) console.warn(`[provider:grizzly] skipped ${skipped} invalid price row(s)`);
    return out;
  }

  async getInventory(serviceCode: string): Promise<Map<string, ProviderInventory>> {
    const data = parseJson(await this.http.request("getPricesV3", { service: serviceCode }, { retry: "safe" }), "getPricesV3");
    const out = new Map<string, ProviderInventory>();
    if (data === null) return out; // unknown service / nothing on sale
    if (!isRecord(data)) throw new ProviderError("INVALID_RESPONSE", "Inventory is not an object", PROVIDER_ID);
    for (const [country, services] of Object.entries(data)) {
      if (!/^\d{1,6}$/.test(country) || !isRecord(services)) continue;
      const cell = InventoryCell.safeParse(services[serviceCode]);
      if (!cell.success || cell.data.count <= 0) continue;
      // Price levels: each supplier's cheapest level with its stock.
      const levels = new Map<number, number>();
      for (const p of Object.values(cell.data.providers ?? {})) {
        if (!p.price.length || p.count <= 0) continue;
        const cost = Math.min(...p.price.map(costToMinor));
        levels.set(cost, (levels.get(cost) ?? 0) + p.count);
      }
      const base = costToMinor(cell.data.price);
      const tiers: ProviderPriceTier[] = levels.size
        ? [...levels].map(([cost, count]) => ({ cost, count })).sort((a, b) => a.cost - b.cost)
        : [{ cost: base, count: cell.data.count }];
      out.set(country, { cost: base, count: cell.data.count, tiers });
    }
    return out;
  }

  /* ----------------------------------------------------------- activation -- */

  async purchaseNumber(
    request: { serviceCode: string; countryCode: string; maxCost?: number },
    ctx: CallContext = {},
  ): Promise<ProviderActivation> {
    const params: Record<string, string> = { service: request.serviceCode, country: request.countryCode };
    if (request.maxCost !== undefined) params.maxPrice = (request.maxCost / 10_000).toFixed(4).replace(/\.?0+$/, "");
    // Buying is never retried: a retry could buy a second number.
    const body = await this.http.request("getNumberV2", params, { retry: "once", timeoutMs: 30_000, ...ctx });

    const v1 = /^ACCESS_NUMBER:(\d{1,20}):(\d{6,20})$/.exec(body);
    if (v1) {
      return { activationId: v1[1], phoneNumber: v1[2], cost: null, canGetAnotherSms: false, cancelAfterSeconds: null, expiresInSeconds: null };
    }
    const parsed = NumberV2.safeParse(parseJson(body, "getNumberV2"));
    if (!parsed.success) throw new ProviderError("INVALID_RESPONSE", "Purchase response is missing required fields", PROVIDER_ID);
    const d = parsed.data;
    return {
      activationId: d.activationId,
      phoneNumber: d.phoneNumber,
      cost: d.activationCost !== undefined ? costToMinor(d.activationCost) : null,
      canGetAnotherSms: String(d.canGetAnotherSms) === "1" || d.canGetAnotherSms === true,
      cancelAfterSeconds: secondsBetween(d.activationTime, d.activationCancel),
      expiresInSeconds: secondsBetween(d.activationTime, d.activationEnd),
    };
  }

  async getActiveActivations(ctx: CallContext = {}): Promise<ProviderActiveActivation[]> {
    const data = parseJson(await this.http.request("getActiveActivations", {}, { retry: "safe", ...ctx }), "getActiveActivations");
    if (data === null) return [];
    if (!Array.isArray(data)) throw new ProviderError("INVALID_RESPONSE", "Active activations are not a list", PROVIDER_ID);
    return validRows(data, ActiveRow, "activation").map((a) => ({
      activationId: a.activationId,
      phoneNumber: a.phoneNumber,
      serviceCode: a.serviceCode,
      countryCode: a.countryCode,
      cost: a.activationCost !== undefined ? costToMinor(a.activationCost) : null,
    }));
  }

  async getActivationState(id: string, ctx: CallContext = {}): Promise<ActivationState> {
    let body: string;
    try {
      body = await this.http.request("getStatus", { id }, { retry: "safe", providerRef: id, ...ctx });
    } catch (error) {
      if (error instanceof ProviderError && error.code === "NOT_FOUND") return { state: "not_found" };
      throw error;
    }
    const ok = /^STATUS_OK:(.{1,32})$/.exec(body);
    if (ok) return { state: "code", code: ok[1].trim() };
    if (/^STATUS_WAIT_RETRY(:|$)/.test(body)) return { state: "waiting_retry", lastCode: body.split(":")[1]?.slice(0, 32) ?? null };
    if (body === "STATUS_CANCEL") return { state: "cancelled" };
    if (body === "STATUS_WAIT_CODE" || body === "STATUS_WAIT_RESEND") return { state: "waiting" };
    throw new ProviderError("INVALID_RESPONSE", "Unexpected activation status", PROVIDER_ID);
  }

  async getLatestSms(id: string, ctx: CallContext = {}): Promise<ProviderSms | null> {
    const body = await this.http.request("getStatusV2", { id }, { retry: "safe", providerRef: id, ...ctx });
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return null; // v1-style answer: the code from getStatus is all we have
    }
    const parsed = StatusV2.safeParse(data);
    if (!parsed.success || !parsed.data.sms) return null;
    const sms = parsed.data.sms;
    const text = String(sms.text ?? sms.code ?? "").slice(0, 5000);
    if (!text) return null;
    const at = sms.dateTime ? Date.parse(sms.dateTime.replace(" ", "T") + "Z") : NaN;
    return {
      code: sms.code !== undefined ? String(sms.code).slice(0, 32) : null,
      text,
      receivedAt: Number.isFinite(at) ? new Date(at) : null,
    };
  }

  async changeStatus(id: string, change: StatusChange, ctx: CallContext = {}): Promise<void> {
    const status = { cancel: "8", finish: "6", request_another: "3" }[change];
    // State changes are never retried automatically.
    const body = await this.http.request("setStatus", { id, status }, { retry: "once", providerRef: id, ...ctx });
    const ok = { cancel: ["ACCESS_CANCEL"], finish: ["ACCESS_ACTIVATION"], request_another: ["ACCESS_RETRY_GET", "ACCESS_READY"] }[change];
    if (!ok.includes(body)) throw new ProviderError("INVALID_RESPONSE", "Unexpected setStatus response", PROVIDER_ID);
  }
}
