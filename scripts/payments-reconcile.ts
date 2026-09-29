/**
 * Brings top-up payments in line with the payment provider: credits payments
 * that were paid but not yet confirmed (late or lost webhooks, closed
 * browsers), closes expired ones, and reports payments flagged for review.
 * Run every few minutes from cron / a scheduler:  npm run payments:reconcile
 */
import "./_env";
import { db } from "@/server/db";
import { reconcilePayments } from "@/server/services/payment.service";

reconcilePayments()
  .then((r) => {
    console.log(`Checked ${r.checked} payment(s): ${r.paid} newly paid, ${r.closed} closed, ${r.unreachable} unreachable.`);
    if (r.needsReview) console.warn(`${r.needsReview} payment(s) need manual review (payments.needs_review = 1).`);
  })
  .catch((error) => {
    console.error("Reconciliation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
