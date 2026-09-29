"use server";

import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import {
  cancelOrder,
  finishOrder,
  requestAnotherSms,
  requestNumber,
  type OrderActionResult,
} from "@/server/services/order.service";

/**
 * Order actions. The user comes from the session (never from the client);
 * service/country/price are re-validated server-side in the order service.
 */

const SIGN_IN: OrderActionResult = { ok: false, code: "NOT_ALLOWED", message: "Please log in to continue." };
const FAILED: OrderActionResult = { ok: false, code: "PROVIDER_ERROR", message: "Something went wrong. Please try again." };

const requestSchema = z.object({
  service: z.string().min(1).max(64),
  country: z.string().regex(/^\d{1,10}$/),
  /** The price the customer saw (minor units); only used to confirm agreement. */
  price: z.number().int().positive().max(1_000_000_000),
  /** Generated once per purchase dialog so double submits can't double charge. */
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
});

async function run(name: string, body: (userId: string) => Promise<OrderActionResult>): Promise<OrderActionResult> {
  const user = await getCurrentUser();
  if (!user) return SIGN_IN;
  try {
    return await body(user.id);
  } catch (error) {
    console.error(`[orders] ${name} failed:`, error instanceof Error ? error.message : "unknown error");
    return FAILED;
  }
}

export async function requestNumberAction(input: unknown): Promise<OrderActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Invalid request." };
  return run("request", (userId) => requestNumber(userId, parsed.data));
}

const idSchema = z.uuid();

export async function cancelOrderAction(orderId: unknown): Promise<OrderActionResult> {
  const id = idSchema.safeParse(orderId);
  if (!id.success) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  return run("cancel", (userId) => cancelOrder(userId, id.data));
}

export async function finishOrderAction(orderId: unknown): Promise<OrderActionResult> {
  const id = idSchema.safeParse(orderId);
  if (!id.success) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  return run("finish", (userId) => finishOrder(userId, id.data));
}

export async function requestAnotherSmsAction(orderId: unknown): Promise<OrderActionResult> {
  const id = idSchema.safeParse(orderId);
  if (!id.success) return { ok: false, code: "NOT_FOUND", message: "Order not found." };
  return run("request-another", (userId) => requestAnotherSms(userId, id.data));
}
