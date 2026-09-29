/**
 * Finalize expired/stuck orders and refund those that never received an SMS.
 * Run every minute from cron / a scheduler:  npm run orders:sweep
 */
import "./_env";
import { db } from "@/server/db";
import { sweepExpiredOrders } from "@/server/services/order.service";

sweepExpiredOrders()
  .then((n) => console.log(`Checked ${n} due order(s).`))
  .catch((error) => {
    console.error("Sweep failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
