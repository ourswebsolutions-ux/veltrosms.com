import "server-only";
import { ProviderError, type SmsProvider } from "./types";

/**
 * Used when no provider is configured (or its API key is missing). Every call
 * fails with NOT_CONFIGURED so callers show an explicit "unavailable" state.
 */
export class UnconfiguredProvider implements SmsProvider {
  readonly id = "none";
  readonly capabilities = new Set<never>();

  private fail(): never {
    throw new ProviderError("NOT_CONFIGURED", "No SMS provider is configured.", this.id);
  }

  getBalance = async () => this.fail();
  getCountries = async () => this.fail();
  getServices = async () => this.fail();
  getPrices = async () => this.fail();
  getInventory = async () => this.fail();
  purchaseNumber = async () => this.fail();
  getActiveActivations = async () => this.fail();
  getActivationState = async () => this.fail();
  getLatestSms = async () => this.fail();
  changeStatus = async () => this.fail();
}
