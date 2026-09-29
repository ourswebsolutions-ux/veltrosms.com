import "server-only";
import { PaymentProviderError, type PaymentMethodInfo, type PaymentProvider, type ProviderPaymentState, type VerifiedWebhook } from "../types";

/**
 * Manual Easypaisa / JazzCash top-ups (the current payment method).
 *
 * There is no gateway API: the customer sends money to the account shown on
 * the Add funds page and submits the transaction ID; an administrator checks
 * the Easypaisa/JazzCash statement and approves or rejects the request
 * (payment.service approveManualTopUp / rejectManualTopUp). Nothing is ever
 * credited without that approval.
 *
 * Future Easypaisa / JazzCash API adapters implement PaymentProvider with
 * flow "redirect" and plug into the same payment + wallet flow.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual";
  readonly label = "Manual Easypaisa / JazzCash";
  readonly live = true;
  readonly flow = "manual" as const;

  methods(): PaymentMethodInfo[] {
    return [
      { id: "easypaisa", label: "Easypaisa", description: "Send from your Easypaisa account", kind: "local" },
      { id: "jazzcash", label: "JazzCash", description: "Send from your JazzCash account", kind: "local" },
    ];
  }

  async createPayment(): Promise<never> {
    throw new PaymentProviderError("BAD_REQUEST", "Manual payments are submitted as top-up requests", this.id);
  }

  /** No remote status exists: an administrator's review is the verification. */
  async getPayment(): Promise<ProviderPaymentState> {
    throw new PaymentProviderError("NOT_FOUND", "Manual payments have no provider status", this.id);
  }

  verifyWebhook(): VerifiedWebhook {
    throw new PaymentProviderError("INVALID_SIGNATURE", "Manual payments don't use webhooks", this.id);
  }
}
