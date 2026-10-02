/** Ready Made Accounts DTOs shared by server and client. Amounts are integer minor units (lib/money). */

export type ReadyMadeOfferView = {
  id: number;
  service: { name: string; color: string; logo: string | null };
  /** null = All countries. */
  country: { name: string; iso2: string | null } | null;
  price: number;
  currency: string;
  /** Accounts in hand for this offer; 0 = out of stock (can't be bought). */
  available: number;
};

export type ReadyMadeOrderView = {
  id: string;
  /** Public reference the customer gives support, e.g. "RM-7K3F9Q2A". */
  reference: string;
  service: { name: string; color: string; logo: string | null };
  country: { name: string; iso2: string | null } | null;
  price: number;
  currency: string;
  status: "awaiting_delivery" | "completed";
  createdAt: string;
  /** When the customer marked it completed. */
  completedAt: string | null;
};

export type ReadyMadeCompleteResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "ALREADY_COMPLETED" | "NOT_ALLOWED" | "ERROR"; message: string };

export type ReadyMadePurchaseResult =
  | { ok: true; orderId: string; reference: string }
  | {
      ok: false;
      code: "INVALID" | "UNAVAILABLE" | "OUT_OF_STOCK" | "PRICE_CHANGED" | "INSUFFICIENT_FUNDS" | "RATE_LIMITED" | "NOT_ALLOWED" | "ERROR";
      message: string;
      /** The current price when it changed since the customer looked. */
      price?: number;
    };
