import "server-only";
import { toDecimalString, toMinor } from "@/lib/money";
import { db, isUniqueViolation, Prisma } from "@/server/db";
import type { TransactionStatus, TransactionType } from "@/generated/prisma/client";
import { platformCurrency } from "./currency";

/**
 * The only code allowed to change a balance.
 *
 * Every operation runs in one database transaction that:
 *   1. locks the wallet row (SELECT … FOR UPDATE) — concurrent operations on
 *      the same wallet are serialized, so no lost updates or double spends;
 *   2. returns the existing ledger row if `reference` was already used
 *      (idempotency — a retried request never charges twice);
 *   3. checks funds, updates the balance and appends the ledger row.
 * Anything failing rolls the whole thing back. The database additionally
 * enforces balance >= 0, unique references and an append-only ledger.
 */

export class WalletError extends Error {
  constructor(
    public readonly code: "INSUFFICIENT_FUNDS" | "INVALID_AMOUNT" | "NO_WALLET" | "REFERENCE_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export type LedgerEntry = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number; // signed minor units
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  reference: string;
  description: string | null;
  orderId: string | null;
  paymentId: string | null;
  createdAt: Date;
};

export type WalletOperation = {
  userId: string;
  /** Positive amount in minor units; the direction comes from the operation. */
  amount: number;
  type: TransactionType;
  /** Idempotency key, e.g. "order:<id>:purchase". Must be unique per operation. */
  reference: string;
  description?: string;
  orderId?: string;
  /** Top-up that caused a DEPOSIT. */
  paymentId?: string;
  metadata?: Prisma.InputJsonValue;
};

export type Tx = Prisma.TransactionClient;

function toEntry(t: {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  currency: string;
  reference: string;
  description: string | null;
  orderId: string | null;
  paymentId: string | null;
  createdAt: Date;
}): LedgerEntry {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    amount: toMinor(t.amount),
    balanceBefore: toMinor(t.balanceBefore),
    balanceAfter: toMinor(t.balanceAfter),
    currency: t.currency,
    reference: t.reference,
    description: t.description,
    orderId: t.orderId,
    paymentId: t.paymentId,
    createdAt: t.createdAt,
  };
}

function assertAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new WalletError("INVALID_AMOUNT", "Amount must be a positive whole number of minor units.");
  }
  // 1,000,000 units of currency per single operation is far beyond any real order.
  if (amount > 1_000_000 * 10_000) throw new WalletError("INVALID_AMOUNT", "Amount is too large.");
}

/** Locks and returns the user's wallet inside `tx`, creating it if missing. */
async function lockWallet(tx: Tx, userId: string): Promise<{ id: string; balance: number; currency: string }> {
  const rows = await tx.$queryRaw<{ id: string; balance: string; currency: string }[]>`
    SELECT id, CAST(balance AS CHAR) AS balance, currency FROM wallets WHERE user_id = ${userId} FOR UPDATE`;
  if (rows[0]) return { id: rows[0].id, balance: toMinor(rows[0].balance), currency: rows[0].currency };

  const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw new WalletError("NO_WALLET", "User not found.");
  await tx.wallet.create({ data: { userId, currency: platformCurrency().code } });
  return lockWallet(tx, userId);
}

/**
 * Applies one ledger operation inside an existing database transaction
 * (lock → idempotency check → funds check → balance + ledger row). Use this
 * when the balance change must commit together with other writes, e.g.
 * creating an order and charging for it.
 */
export async function applyInTx(
  tx: Tx,
  op: WalletOperation,
  direction: 1 | -1,
): Promise<{ entry: LedgerEntry; duplicate: boolean }> {
  assertAmount(op.amount);
  const wallet = await lockWallet(tx, op.userId);

  const existing = await tx.transaction.findUnique({ where: { reference: op.reference } });
  if (existing) {
    if (existing.walletId !== wallet.id) {
      throw new WalletError("REFERENCE_CONFLICT", "Reference already used by another wallet.");
    }
    return { entry: toEntry(existing), duplicate: true };
  }

  const delta = direction * op.amount;
  const after = wallet.balance + delta;
  if (after < 0) throw new WalletError("INSUFFICIENT_FUNDS", "Insufficient balance.");

  await tx.wallet.update({ where: { id: wallet.id }, data: { balance: toDecimalString(after) } });
  const created = await tx.transaction.create({
    data: {
      walletId: wallet.id,
      userId: op.userId,
      type: op.type,
      status: "COMPLETED",
      amount: toDecimalString(delta),
      currency: wallet.currency,
      balanceBefore: toDecimalString(wallet.balance),
      balanceAfter: toDecimalString(after),
      reference: op.reference,
      description: op.description?.slice(0, 255) ?? null,
      orderId: op.orderId ?? null,
      paymentId: op.paymentId ?? null,
      metadata: op.metadata,
    },
  });
  return { entry: toEntry(created), duplicate: false };
}

async function apply(op: WalletOperation, direction: 1 | -1): Promise<{ entry: LedgerEntry; duplicate: boolean }> {
  assertAmount(op.amount);
  try {
    return await db().$transaction((tx) => applyInTx(tx, op, direction));
  } catch (error) {
    // A concurrent request with the same reference won the race: return it.
    if (isUniqueViolation(error)) {
      const existing = await db().transaction.findUnique({ where: { reference: op.reference } });
      if (existing && existing.userId === op.userId) return { entry: toEntry(existing), duplicate: true };
      throw new WalletError("REFERENCE_CONFLICT", "Reference already used.");
    }
    throw error;
  }
}

/* ------------------------------------------------------------ operations -- */

export function creditWallet(op: WalletOperation) {
  return apply(op, 1);
}

export function debitWallet(op: WalletOperation) {
  return apply(op, -1);
}

/** Returns funds for an order. Idempotent per order via its reference. */
export function refundWallet(op: Omit<WalletOperation, "type">) {
  return apply({ ...op, type: "REFUND" }, 1);
}

/**
 * Manual correction by staff/scripts (never exposed to users). Positive
 * amounts credit, negative amounts debit.
 */
export function adjustWallet(op: Omit<WalletOperation, "type" | "amount"> & { amount: number; actor: string }) {
  const { actor, amount, ...rest } = op;
  return apply(
    { ...rest, amount: Math.abs(amount), type: "ADJUSTMENT", metadata: { actor } },
    amount >= 0 ? 1 : -1,
  );
}

/* ----------------------------------------------------------------- reads -- */

export async function getBalance(userId: string): Promise<{ balance: number; currency: string; createdAt: Date; updatedAt: Date }> {
  const wallet =
    (await db().wallet.findUnique({ where: { userId } })) ??
    (await db().wallet.create({ data: { userId, currency: platformCurrency().code } }));
  return {
    balance: toMinor(wallet.balance),
    currency: wallet.currency,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

export type TransactionFilter = {
  types?: TransactionType[];
  status?: TransactionStatus;
  from?: Date;
  to?: Date;
  /** Absolute amount bounds, minor units. */
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
};

export async function getTransactionHistory(userId: string, filter: TransactionFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

  const amountBounds: Prisma.TransactionWhereInput[] = [];
  if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
    const min = filter.minAmount ?? 0;
    const max = filter.maxAmount;
    const positive: Prisma.DecimalFilter = { gte: toDecimalString(min), ...(max !== undefined ? { lte: toDecimalString(max) } : {}) };
    const negative: Prisma.DecimalFilter = { lte: toDecimalString(-min), ...(max !== undefined ? { gte: toDecimalString(-max) } : {}) };
    amountBounds.push({ OR: [{ amount: positive }, { amount: negative }] });
  }

  const where: Prisma.TransactionWhereInput = {
    userId,
    ...(filter.types?.length ? { type: { in: filter.types } } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
    AND: amountBounds,
  };

  const [rows, total] = await Promise.all([
    db().transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db().transaction.count({ where }),
  ]);
  return { items: rows.map(toEntry), total, page, pageSize };
}

/** Sum of completed ledger amounts by type (for statistics). */
export async function totalsByType(userId: string, range: { from?: Date; to?: Date } = {}): Promise<Partial<Record<TransactionType, number>>> {
  const groups = await db().transaction.groupBy({
    by: ["type"],
    where: {
      userId,
      status: "COMPLETED",
      ...(range.from || range.to ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    },
    _sum: { amount: true },
  });
  return Object.fromEntries(groups.map((g) => [g.type, g._sum.amount ? toMinor(g._sum.amount) : 0]));
}
