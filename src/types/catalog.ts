/**
 * Catalog DTOs shared between server and client. Plain data only — no provider
 * codes or credentials ever leave the server.
 */
import type { DataSource } from "@/server/providers/types";

export type { DataSource };

export type ServiceSummary = {
  slug: string;
  name: string;
  color: string;
  popular: boolean;
};

export type CountrySummary = {
  /** Our catalog id (a provider may list several numbers per ISO country). */
  id: string;
  /** ISO 3166-1 alpha-2 for the flag, when known. */
  iso2: string | null;
  name: string;
};

export type PriceTier = {
  /** Customer price, integer minor units (see lib/money). */
  price: number;
  available: number;
};

export type Availability = "high" | "medium" | "low";

/** All price levels for one service in one country. */
export type OfferGroup = {
  service: ServiceSummary;
  country: CountrySummary;
  minPrice: number;
  totalAvailable: number;
  availability: Availability;
  /** Sorted by price, highest first. */
  tiers: PriceTier[];
  currency: string;
};

export type Result<T> =
  | { status: "ok"; source: DataSource; data: T }
  | { status: "unavailable"; reason: "not_configured" | "upstream_error"; message: string };
