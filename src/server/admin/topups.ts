import "server-only";
import { formatMoney } from "@/lib/money";
import { approveManualTopUp, rejectManualTopUp } from "@/server/services/payment.service";
import { audit } from "./audit";
import type { AdminActor } from "./guard";
import type { AdminResult } from "./users";

/**
 * Admin review of manual Easypaisa / JazzCash top-ups. The money logic (lock,
 * PENDING check, single ledger credit) and the success audit records live in
 * one transaction in payment.service; refused attempts are audited here.
 */

export async function approveTopUp(actor: AdminActor, paymentId: string): Promise<AdminResult> {
  const r = await approveManualTopUp(actor, paymentId);
  if (!r.ok) {
    await audit(actor, "topup.approve", { type: "payment", id: paymentId }, false, { error: r.code }, `Approval refused: ${r.message}`);
    return { ok: false, message: r.message };
  }
  return { ok: true, message: `Approved. ${formatMoney(r.payment.amount, r.payment.currency)} credited to the customer's wallet.` };
}

export async function rejectTopUp(actor: AdminActor, paymentId: string, reason: string): Promise<AdminResult> {
  const r = await rejectManualTopUp(actor, paymentId, reason);
  if (!r.ok) {
    await audit(actor, "topup.reject", { type: "payment", id: paymentId }, false, { error: r.code }, `Rejection refused: ${r.message}`);
    return { ok: false, message: r.message };
  }
  return { ok: true, message: "Request rejected. The customer can see the reason." };
}
