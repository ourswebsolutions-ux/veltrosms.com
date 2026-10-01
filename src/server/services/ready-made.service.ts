import "server-only";
import { serviceLogo } from "@/lib/service-logos";
import { randomInt } from "node:crypto";
import { toDecimalString, toMinor } from "@/lib/money";
import { hitRateLimit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { serviceColor } from "@/server/catalog/service-hints";
import { db, isUniqueViolation } from "@/server/db";
import type { ReadyMadeCompleteResult, ReadyMadeOfferView, ReadyMadeOrderView, ReadyMadePurchaseResult } from "@/types/ready-made";
import { getSetting, whatsappDigits } from "./settings.service";
import { applyInTx, WalletError } from "./wallet.service";

/**
 * Ready Made Accounts — the customer side.
 *
 * A Ready Made purchase is paid from the wallet and delivered MANUALLY: the
 * customer contacts support on WhatsApp with the order reference. Nothing in
 * this module talks to the SMS provider (no balance check, no number request,
 * no polling), and purchases live in their own table (`ready_made_orders`), so
 * the provider order sweep (sweepExpiredOrders / refreshOrder) never sees them.
 *
 * One database transaction:
 *   1. locks the offer row (an admin can't disable/reprice it mid-purchase)
 *      and re-checks it is on sale at the price the customer agreed to;
 *   2. creates the order (unique per user + idempotency key);
 *   3. debits the wallet through the ledger (applyInTx: wallet row lock, no
 *      negative balance, unique reference "ready_made:<id>:charge").
 * Any failure rolls all of it back. The amount always comes from the offer.
 */

/** Used when the admin hasn't set a WhatsApp number (same default as manual top-ups). */
const DEFAULT_WHATSAPP = "03246623395";
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L

function newReference(): string {
  let s = "RM-";
  for (let i = 0; i < 8; i++) s += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return s;
}

const ALL_COUNTRIES = "All countries";

/** Offers customers can buy: enabled by the admin, for a service (and country) that is switched on locally. */
const ON_SALE = {
  isActive: true,
  service: { isActive: true },
  OR: [{ countryId: null }, { country: { isActive: true } }],
};

export async function listReadyMadeOffers(): Promise<ReadyMadeOfferView[]> {
  const rows = await db().readyMadeOffer.findMany({
    where: ON_SALE,
    include: { service: { select: { name: true, providerCode: true } }, country: { select: { name: true, iso2: true } } },
    orderBy: [{ service: { isPopular: "desc" } }, { service: { name: "asc" } }, { countryKey: "asc" }],
  });
  return rows.map((o) => ({
    id: o.id,
    service: { name: o.service.name, color: serviceColor(o.service.providerCode, o.service.name), logo: serviceLogo(o.service.providerCode) },
    country: o.country ? { name: o.country.name, iso2: o.country.iso2 } : null,
    price: toMinor(o.price),
    currency: o.currency,
  }));
}

/** Where customers send their order reference. Admin-editable (Settings → manual payments). */
export async function readyMadeContact(): Promise<{ whatsapp: string; whatsappDigits: string }> {
  const manual = await getSetting("manual_payment");
  const whatsapp = manual.whatsapp && whatsappDigits(manual.whatsapp) ? manual.whatsapp : DEFAULT_WHATSAPP;
  return { whatsapp, whatsappDigits: whatsappDigits(whatsapp)! };
}

const toView = (o: {
  id: string;
  reference: string;
  serviceName: string;
  countryName: string | null;
  price: { toString(): string };
  currency: string;
  status: "AWAITING_DELIVERY" | "COMPLETED";
  createdAt: Date;
  completedAt: Date | null;
  service: { providerCode: string; name: string };
  country: { iso2: string | null } | null;
}): ReadyMadeOrderView => ({
  id: o.id,
  reference: o.reference,
  service: { name: o.serviceName, color: serviceColor(o.service.providerCode, o.service.name), logo: serviceLogo(o.service.providerCode) },
  country: o.countryName ? { name: o.countryName, iso2: o.country?.iso2 ?? null } : null,
  price: toMinor(o.price),
  currency: o.currency,
  status: o.status === "COMPLETED" ? "completed" : "awaiting_delivery",
  createdAt: o.createdAt.toISOString(),
  completedAt: o.completedAt?.toISOString() ?? null,
});

const orderInclude = { service: { select: { providerCode: true, name: true } }, country: { select: { iso2: true } } } as const;

/** One of the user's own Ready Made orders. Anyone else's id is simply not found. */
export async function getReadyMadeOrder(userId: string, orderId: string): Promise<ReadyMadeOrderView | null> {
  const o = await db().readyMadeOrder.findFirst({ where: { id: orderId, userId }, include: orderInclude });
  return o ? toView(o) : null;
}

export async function listReadyMadeOrders(userId: string, limit = 10): Promise<ReadyMadeOrderView[]> {
  const rows = await db().readyMadeOrder.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map(toView);
}

/**
 * The buyer confirms they received their Ready Made account (after contacting
 * support on WhatsApp). Only the buyer, only AWAITING_DELIVERY → COMPLETED,
 * once: the conditional update makes ownership and the transition atomic. It
 * never happens automatically and doesn't touch the wallet.
 */
export async function completeReadyMadeOrder(userId: string, orderId: string): Promise<ReadyMadeCompleteResult> {
  const updated = await db().readyMadeOrder.updateMany({
    where: { id: orderId, userId, status: "AWAITING_DELIVERY" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (updated.count === 1) return { ok: true };
  const order = await db().readyMadeOrder.findFirst({ where: { id: orderId, userId }, select: { status: true } });
  if (!order) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  return { ok: false, code: "ALREADY_COMPLETED", message: "This order is already marked as completed." };
}

/* ---------------------------------------------------------------- buying -- */

class NotOnSale extends Error {}
class PriceChanged extends Error {
  constructor(public readonly price: number) {
    super("price changed");
  }
}

const UNAVAILABLE: ReadyMadePurchaseResult = {
  ok: false,
  code: "UNAVAILABLE",
  message: "This Ready Made offer is no longer available. You have not been charged.",
};

export async function purchaseReadyMade(
  userId: string,
  input: { offerId: number; price: number; idempotencyKey: string },
): Promise<ReadyMadePurchaseResult> {
  // A resubmitted request (double click, retry after a lost response) returns the order it already created.
  const existing = await db().readyMadeOrder.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    select: { id: true, reference: true },
  });
  if (existing) return { ok: true, orderId: existing.id, reference: existing.reference };

  const maintenance = await getSetting("maintenance");
  if (maintenance.enabled) {
    return { ok: false, code: "UNAVAILABLE", message: maintenance.message || "We're doing maintenance. Purchases are paused for a short while." };
  }

  const limit = await hitRateLimit(`purchase:user:${userId}`, RATE_LIMITS.purchasePerUser);
  if (!limit.allowed) return { ok: false, code: "RATE_LIMITED", message: "Too many requests. Please wait a moment." };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await db().$transaction(async (tx) => {
        // Lock the offer: a concurrent admin disable/reprice/delete waits for this purchase (or vice versa).
        const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM ready_made_offers WHERE id = ${input.offerId} FOR UPDATE`;
        if (!locked[0]) throw new NotOnSale();
        const offer = await tx.readyMadeOffer.findFirst({
          where: { id: input.offerId, ...ON_SALE },
          include: { service: { select: { name: true } }, country: { select: { name: true } } },
        });
        if (!offer) throw new NotOnSale();
        const price = toMinor(offer.price);
        if (price !== input.price) throw new PriceChanged(price);

        const created = await tx.readyMadeOrder.create({
          data: {
            reference: newReference(),
            userId,
            offerId: offer.id,
            serviceId: offer.serviceId,
            countryId: offer.countryId,
            serviceName: offer.service.name,
            countryName: offer.country?.name ?? null,
            price: toDecimalString(price),
            currency: offer.currency,
            idempotencyKey: input.idempotencyKey,
          },
        });
        await applyInTx(
          tx,
          {
            userId,
            amount: price,
            type: "PURCHASE",
            reference: `ready_made:${created.id}:charge`,
            description: `Ready Made account: ${offer.service.name} · ${offer.country?.name ?? ALL_COUNTRIES} (${created.reference})`,
            metadata: { readyMadeOrderId: created.id, offerId: offer.id },
          },
          -1,
        );
        return created;
      });
      return { ok: true, orderId: order.id, reference: order.reference };
    } catch (error) {
      if (error instanceof NotOnSale) return UNAVAILABLE;
      if (error instanceof PriceChanged) {
        return { ok: false, code: "PRICE_CHANGED", message: "The price has changed. Please review the new price.", price: error.price };
      }
      if (error instanceof WalletError && error.code === "INSUFFICIENT_FUNDS") {
        return { ok: false, code: "INSUFFICIENT_FUNDS", message: "Not enough balance. Please top up your balance." };
      }
      if (isUniqueViolation(error)) {
        // Same idempotency key submitted concurrently: return the winner.
        const winner = await db().readyMadeOrder.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, reference: true },
        });
        if (winner) return { ok: true, orderId: winner.id, reference: winner.reference };
        continue; // a reference collision (rare): try again with a new reference
      }
      throw error;
    }
  }
  throw new Error("Could not allocate an order reference.");
}
