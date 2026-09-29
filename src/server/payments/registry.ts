import "server-only";
import { env } from "@/server/env";
import { ManualPaymentProvider } from "./manual/manual-provider";
import type { PaymentProvider } from "./types";

/**
 * The active top-up provider, chosen by PAYMENT_PROVIDER:
 *  - "manual" (default): Easypaisa / JazzCash sent by the customer and
 *    approved by an administrator;
 *  - "none": top-ups are shown as unavailable.
 * Future gateway adapters (Easypaisa API, JazzCash API) implement
 * PaymentProvider with flow "redirect" and get one case here.
 */

let override: PaymentProvider | null | undefined;
let cached: PaymentProvider | null | undefined;

export function getPaymentProvider(): PaymentProvider | null {
  if (override !== undefined) return override;
  if (cached !== undefined) return cached;
  switch (env().PAYMENT_PROVIDER) {
    case "manual":
      cached = new ManualPaymentProvider();
      break;
    case "none":
      cached = null;
      break;
  }
  return cached ?? null;
}

/** Tests only: substitute a provider (undefined restores the configured one). */
export function setPaymentProviderForTesting(provider: PaymentProvider | null | undefined) {
  override = provider;
}
