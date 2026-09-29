import {
  PaymentProviderError,
  type CreatePaymentRequest,
  type CreatedPayment,
  type PaymentMethodInfo,
  type PaymentProvider,
  type ProviderPaymentState,
  type VerifiedWebhook,
} from "@/server/payments/types";

/** Scriptable in-memory payment provider for tests. Never touches the network. */
export class FakePaymentProvider implements PaymentProvider {
  readonly id = "fakepay";
  readonly label = "Fake pay";
  readonly live = true;
  readonly flow = "redirect" as const;

  payments = new Map<string, ProviderPaymentState>();
  createError: PaymentProviderError | null = null;
  /** Simulate "the create call failed but the provider did create it". */
  createDespiteError = false;
  getError: PaymentProviderError | null = null;
  calls: { method: string; args: unknown[] }[] = [];
  private next = 1;

  methods(): PaymentMethodInfo[] {
    return [{ id: "card", label: "Card", kind: "card" }];
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatedPayment> {
    this.calls.push({ method: "createPayment", args: [req] });
    const id = `fp_${this.next++}`;
    if (this.createError) {
      if (this.createDespiteError) this.payments.set(id, { providerPaymentId: id, status: "pending", amount: req.amount, currency: req.currency, reference: req.reference });
      throw this.createError;
    }
    this.payments.set(id, { providerPaymentId: id, status: "pending", amount: req.amount, currency: req.currency, reference: req.reference });
    return { providerPaymentId: id, checkoutUrl: `https://pay.example.test/checkout/${id}`, expiresAt: null };
  }

  async getPayment(id: string): Promise<ProviderPaymentState> {
    this.calls.push({ method: "getPayment", args: [id] });
    if (this.getError) throw this.getError;
    const p = this.payments.get(id);
    if (!p) throw new PaymentProviderError("NOT_FOUND", "unknown", this.id);
    return { ...p };
  }

  async findPaymentByReference(reference: string): Promise<ProviderPaymentState | null> {
    this.calls.push({ method: "findPaymentByReference", args: [reference] });
    if (this.getError) throw this.getError;
    for (const p of this.payments.values()) if (p.reference === reference) return { ...p };
    return null;
  }

  verifyWebhook(rawBody: string, headers: Headers): VerifiedWebhook {
    if (headers.get("x-fake-signature") !== "valid") throw new PaymentProviderError("INVALID_SIGNATURE", "bad signature", this.id);
    try {
      const body = JSON.parse(rawBody) as { id: string; paymentId: string };
      if (typeof body.id !== "string" || typeof body.paymentId !== "string") throw new Error("shape");
      return { eventId: body.id, type: "payment.updated", providerPaymentId: body.paymentId, reference: null };
    } catch {
      throw new PaymentProviderError("INVALID_PAYLOAD", "bad payload", this.id);
    }
  }

  /** The customer pays (or the provider changes the payment) at the provider. */
  set(id: string, patch: Partial<ProviderPaymentState>) {
    this.payments.set(id, { ...this.payments.get(id)!, ...patch });
  }
}
