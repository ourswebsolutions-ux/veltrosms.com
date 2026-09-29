import {
  ProviderError,
  type ActivationState,
  type CallContext,
  type ProviderActivation,
  type ProviderActiveActivation,
  type ProviderCapability,
  type ProviderInventory,
  type ProviderSms,
  type SmsProvider,
  type StatusChange,
} from "@/server/providers/types";

/** Scriptable in-memory provider for tests. Never touches the network. */
export class FakeProvider implements SmsProvider {
  readonly id = "fake";
  readonly capabilities = new Set<ProviderCapability>(["balance", "catalog", "prices", "purchase", "status", "cancel"]);

  countries = [
    { providerCode: "12", name: "USA", visible: true },
    { providerCode: "16", name: "United Kingdom", visible: true },
  ];
  services = [
    { providerCode: "tg", name: "Telegram" },
    { providerCode: "wa", name: "WhatsApp" },
  ];
  /** serviceCode → countryCode → price levels (provider cost, minor units). */
  tiers: Record<string, Record<string, { cost: number; count: number }[]>> = {
    tg: { "12": [{ cost: 3500, count: 50 }, { cost: 5000, count: 10 }], "16": [{ cost: 8000, count: 5 }] },
    wa: { "12": [{ cost: 12000, count: 3 }] },
  };

  /** Our balance at the provider (minor units). */
  balance = 1_000_000;
  purchaseError: ProviderError | null = null;
  /** Simulate "the request failed but the provider did issue a number". */
  issueDespiteError = false;
  inventoryError: ProviderError | null = null;
  states = new Map<string, ActivationState>();
  sms = new Map<string, ProviderSms>();
  cancelError: ProviderError | null = null;
  /** Runs while the purchase call is "in flight" (before the provider answers). */
  onPurchase: ((ctx?: CallContext) => Promise<void>) | null = null;
  calls: { method: string; args: unknown[] }[] = [];
  private active: ProviderActiveActivation[] = [];
  private nextId = 1000;

  getBalance = async () => this.balance;
  getCountries = async () => this.countries;
  getServices = async () => this.services;
  getPrices = async () =>
    Object.entries(this.tiers).flatMap(([serviceCode, byCountry]) =>
      Object.entries(byCountry).map(([countryCode, levels]) => ({
        serviceCode,
        countryCode,
        cost: Math.min(...levels.map((l) => l.cost)),
        count: levels.reduce((s, l) => s + l.count, 0),
      })),
    );

  async getInventory(serviceCode: string): Promise<Map<string, ProviderInventory>> {
    this.calls.push({ method: "getInventory", args: [serviceCode] });
    if (this.inventoryError) throw this.inventoryError;
    return new Map(
      Object.entries(this.tiers[serviceCode] ?? {}).map(([country, levels]) => [
        country,
        { cost: Math.min(...levels.map((l) => l.cost)), count: levels.reduce((s, l) => s + l.count, 0), tiers: levels },
      ]),
    );
  }

  async purchaseNumber(request: { serviceCode: string; countryCode: string; maxCost?: number }, ctx?: CallContext): Promise<ProviderActivation> {
    this.calls.push({ method: "purchaseNumber", args: [request, ctx] });
    if (this.onPurchase) await this.onPurchase(ctx);
    const id = String(this.nextId++);
    if (this.purchaseError) {
      if (this.issueDespiteError) this.open(id, request);
      throw this.purchaseError;
    }
    this.open(id, request);
    return {
      activationId: id,
      phoneNumber: `1555000${id}`,
      cost: request.maxCost ?? null,
      canGetAnotherSms: true,
      cancelAfterSeconds: 0,
      expiresInSeconds: 1200,
    };
  }

  private open(id: string, request: { serviceCode: string; countryCode: string; maxCost?: number }) {
    this.states.set(id, { state: "waiting" });
    this.active.push({ activationId: id, phoneNumber: `1555000${id}`, serviceCode: request.serviceCode, countryCode: request.countryCode, cost: request.maxCost ?? null });
  }

  getActiveActivations = async () => this.active.filter((a) => this.states.get(a.activationId)?.state !== "cancelled");

  async getActivationState(activationId: string): Promise<ActivationState> {
    return this.states.get(activationId) ?? { state: "not_found" };
  }

  async getLatestSms(activationId: string) {
    return this.sms.get(activationId) ?? null;
  }

  async changeStatus(activationId: string, change: StatusChange) {
    this.calls.push({ method: "changeStatus", args: [activationId, change] });
    if (change === "cancel" && this.cancelError) throw this.cancelError;
    if (change === "cancel") this.states.set(activationId, { state: "cancelled" });
    if (change === "request_another") this.states.set(activationId, { state: "waiting_retry", lastCode: null });
  }

  /** Simulates an SMS arriving. */
  deliver(activationId: string, code: string, text = `Your code is ${code}`) {
    this.states.set(activationId, { state: "code", code });
    this.sms.set(activationId, { code, text, receivedAt: new Date() });
  }
}

export const noNumbers = () => new ProviderError("NO_NUMBERS", "NO_NUMBERS", "fake");
