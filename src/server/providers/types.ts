/**
 * Provider-neutral contract for upstream virtual-number suppliers.
 *
 * Business services depend only on these types; each adapter maps its own
 * wire format onto them. Amounts are integer minor units (1/10,000) in the
 * provider's billing currency.
 */

/** Where a piece of data came from. */
export type DataSource = "live";

export type ProviderCountry = { providerCode: string; name: string; visible: boolean };
export type ProviderService = { providerCode: string; name: string };

/** Cheapest current offer for a service in a country. */
export type ProviderPrice = { serviceCode: string; countryCode: string; cost: number; count: number };

/** One price level with its available quantity. */
export type ProviderPriceTier = { cost: number; count: number };

/** Live inventory for one service in one country. */
export type ProviderInventory = { cost: number; count: number; tiers: ProviderPriceTier[] };

export type ProviderActivation = {
  activationId: string;
  phoneNumber: string;
  /** What the provider charged, if reported. */
  cost: number | null;
  canGetAnotherSms: boolean;
  /** Seconds from now until the activation may be cancelled / ends. */
  cancelAfterSeconds: number | null;
  expiresInSeconds: number | null;
};

/** An activation as listed by the provider (used to reconcile ambiguous purchases). */
export type ProviderActiveActivation = {
  activationId: string;
  phoneNumber: string;
  serviceCode: string;
  countryCode: string;
  cost: number | null;
};

export type ActivationState =
  | { state: "waiting" }
  | { state: "waiting_retry"; lastCode: string | null }
  | { state: "code"; code: string }
  | { state: "cancelled" }
  | { state: "not_found" };

export type ProviderSms = { code: string | null; text: string; receivedAt: Date | null };

export type StatusChange = "cancel" | "finish" | "request_another";

export type ProviderCapability = "balance" | "catalog" | "prices" | "purchase" | "status" | "cancel";

/** Context attached to provider calls for logging/reconciliation. */
export type CallContext = { orderId?: string; userId?: string };

export interface SmsProvider {
  /** Stable identifier stored on catalog rows, orders and request logs. */
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;

  /** Our account balance at the provider (operations only — never shown to customers). */
  getBalance(): Promise<number>;
  getCountries(): Promise<ProviderCountry[]>;
  getServices(): Promise<ProviderService[]>;
  /** All current cheapest offers (country × service). */
  getPrices(): Promise<ProviderPrice[]>;
  /** Live inventory for one service across countries, keyed by country code. */
  getInventory(serviceCode: string): Promise<Map<string, ProviderInventory>>;

  purchaseNumber(request: { serviceCode: string; countryCode: string; maxCost?: number }, ctx?: CallContext): Promise<ProviderActivation>;
  /** Activations currently open on our provider account. */
  getActiveActivations(ctx?: CallContext): Promise<ProviderActiveActivation[]>;
  getActivationState(activationId: string, ctx?: CallContext): Promise<ActivationState>;
  /** Full text of the latest SMS, when the provider supports it. */
  getLatestSms(activationId: string, ctx?: CallContext): Promise<ProviderSms | null>;
  changeStatus(activationId: string, change: StatusChange, ctx?: CallContext): Promise<void>;
}

export type ProviderErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "PROVIDER_NO_BALANCE"
  | "NO_NUMBERS"
  | "PRICE_TOO_LOW"
  | "SERVICE_BLOCKED"
  | "REGION_BLOCKED"
  | "NOT_FOUND"
  | "EARLY_CANCEL"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID_RESPONSE";

export class ProviderError extends Error {
  public readonly retryAfterMs?: number;
  public readonly rawCode?: string;

  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly providerId?: string,
    options?: { cause?: unknown; retryAfterMs?: number; rawCode?: string },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
    this.retryAfterMs = options?.retryAfterMs;
    this.rawCode = options?.rawCode;
  }

  /** True when we can't know whether the provider acted (e.g. a purchase timed out). */
  get ambiguous(): boolean {
    return this.code === "TIMEOUT" || this.code === "UNAVAILABLE" || this.code === "INVALID_RESPONSE";
  }
}

/** Safe metadata recorded for every provider call attempt. */
export type ProviderRequestLog = {
  provider: string;
  action: string;
  orderId?: string;
  userId?: string;
  providerRef?: string;
  params: Record<string, string>;
  success: boolean;
  errorCategory: ProviderErrorCode | null;
  errorCode: string | null;
  response: string | null;
  httpStatus: number | null;
  durationMs: number;
  attempt: number;
};
