"use server";

import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { completeReadyMadeOrder, purchaseReadyMade } from "@/server/services/ready-made.service";
import type { ReadyMadeCompleteResult, ReadyMadePurchaseResult } from "@/types/ready-made";

/**
 * Ready Made purchase. The buyer comes from the session (never the client);
 * the offer, its price and the wallet are re-checked on the server. The
 * client's price only confirms what the customer agreed to.
 */

const schema = z.object({
  offerId: z.number().int().positive().max(2_147_483_647),
  /** The price the customer saw (minor units). */
  price: z.number().int().positive().max(1_000_000_000_000),
  /** Generated once per purchase dialog so double submits can't double charge. */
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

export async function purchaseReadyMadeAction(input: unknown): Promise<ReadyMadePurchaseResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "NOT_ALLOWED", message: "Please log in to continue." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Invalid request." };
  try {
    return await purchaseReadyMade(user.id, parsed.data);
  } catch (error) {
    console.error("[ready-made] purchase failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, code: "ERROR", message: "Something went wrong. Please try again — you won't be charged twice." };
  }
}

/** The buyer marks their own Ready Made order as received. Ownership is checked on the server. */
export async function completeReadyMadeOrderAction(orderId: unknown): Promise<ReadyMadeCompleteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "NOT_ALLOWED", message: "Please log in to continue." };
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  try {
    return await completeReadyMadeOrder(user.id, id.data);
  } catch (error) {
    console.error("[ready-made] complete failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, code: "ERROR", message: "Something went wrong. Please try again." };
  }
}
