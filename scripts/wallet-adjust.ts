/**
 * Staff tool: credit or debit a wallet with an audited ADJUSTMENT entry.
 * There is deliberately no web endpoint for this.
 *
 *   npm run wallet:adjust -- --email user@example.com --amount 10 --reason "Manual top-up #123"
 *   npm run wallet:adjust -- --email user@example.com --amount -2.5 --reason "Correction"
 */
import "./_env";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { formatMoney, parseAmount } from "@/lib/money";
import { db } from "@/server/db";
import { adjustWallet } from "@/server/services/wallet.service";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, amount: { type: "string" }, reason: { type: "string" }, reference: { type: "string" } },
  });
  const email = values.email?.trim().toLowerCase();
  const raw = values.amount?.trim() ?? "";
  const negative = raw.startsWith("-");
  const minor = parseAmount(negative ? raw.slice(1) : raw);
  if (!email || minor === null || minor === 0 || !values.reason || values.reason.trim().length < 3) {
    console.error('Usage: npm run wallet:adjust -- --email <email> --amount <10 | -2.5> --reason "<why>"');
    process.exitCode = 1;
    return;
  }
  const user = await db().user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error("No user with that email.");
    process.exitCode = 1;
    return;
  }
  const { entry, duplicate } = await adjustWallet({
    userId: user.id,
    amount: negative ? -minor : minor,
    reference: values.reference ?? `adjust:${randomUUID()}`,
    description: values.reason.trim().slice(0, 255),
    actor: `cli:${userInfo().username}`,
  });
  console.log(
    `${duplicate ? "Already applied" : "Applied"}: ${formatMoney(entry.amount, entry.currency)} → balance ${formatMoney(entry.balanceAfter, entry.currency)} (ref ${entry.reference})`,
  );
}

main()
  .catch((error) => {
    console.error("Adjustment failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
