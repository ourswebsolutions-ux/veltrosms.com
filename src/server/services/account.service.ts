import "server-only";
import { serviceLogo } from "@/lib/service-logos";
import { getCurrentUser, type SessionUser } from "@/server/auth/session";
import { serviceColor } from "@/server/catalog/service-hints";
import { db } from "@/server/db";
import { toMinor } from "@/lib/money";
import type {
  AccountProfile,
  OrderStats,
  Page,
  TransactionListItem,
  TransactionStatus,
  TransactionType,
  Viewer,
} from "@/types/account";
import { platformCurrency } from "./currency";
import { getBalance, getTransactionHistory, totalsByType, type LedgerEntry, type TransactionFilter } from "./wallet.service";

/** Read-side account data for the profile pages and the marketplace. */

export async function getAccountProfile(user: SessionUser): Promise<AccountProfile> {
  const [wallet, row] = await Promise.all([
    getBalance(user.id),
    db().user.findUnique({ where: { id: user.id }, select: { apiKeyHint: true, status: true, emailVerifiedAt: true } }),
  ]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    balance: wallet.balance,
    currency: wallet.currency,
    apiKeyHint: row?.apiKeyHint ?? null,
    status: row?.status === "ACTIVE" ? "active" : "suspended",
    emailVerified: Boolean(row?.emailVerifiedAt),
  };
}

/** Current visitor as the marketplace sees them. */
export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false };
  const wallet = await getBalance(user.id);
  return { signedIn: true, balance: wallet.balance, currency: wallet.currency };
}

/* ---------------------------------------------------------- transactions -- */

export const toTransactionItem = (t: LedgerEntry): TransactionListItem => ({
  id: t.id,
  type: t.type.toLowerCase() as TransactionType,
  status: t.status.toLowerCase() as TransactionStatus,
  amount: t.amount,
  balanceAfter: t.balanceAfter,
  currency: t.currency,
  description: t.description,
  orderId: t.orderId,
  paymentId: t.paymentId,
  createdAt: t.createdAt.toISOString(),
});

export async function listTransactions(userId: string, filter: TransactionFilter = {}): Promise<Page<TransactionListItem>> {
  const page = await getTransactionHistory(userId, filter);
  return { ...page, items: page.items.map(toTransactionItem) };
}

/* ------------------------------------------------------------ statistics -- */

const CHART_MAX_DAYS = 62;
const DAY_MS = 86_400_000;

/**
 * Account statistics for a date range (orders by creation, SMS by arrival,
 * ledger and payments by date), aggregated in the database.
 */
export async function getOrderStats(userId: string, range: { from?: Date; to?: Date } = {}): Promise<OrderStats> {
  const between = range.from || range.to ? { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } : undefined;
  const created = between ? { createdAt: between } : {};

  // Chart window: the range (or the last 14 days), capped to its last 62 days.
  const chartTo = range.to ?? new Date();
  const toDay = Date.UTC(chartTo.getUTCFullYear(), chartTo.getUTCMonth(), chartTo.getUTCDate());
  let fromDay = range.from ? Math.max(range.from.getTime(), toDay - (CHART_MAX_DAYS - 1) * DAY_MS) : toDay - 13 * DAY_MS;
  fromDay = Math.min(fromDay, toDay);

  const [byStatus, smsReceived, totals, perDay, byService, payments, wallet] = await Promise.all([
    db().order.groupBy({ by: ["status"], where: { userId, ...created }, _count: { _all: true } }),
    db().sms.count({ where: { order: { userId }, ...(between ? { receivedAt: between } : {}) } }),
    totalsByType(userId, range),
    db().$queryRaw<{ d: string; total: bigint | number; completed: unknown }[]>`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS total, SUM(status = 'COMPLETED') AS completed
      FROM orders
      WHERE user_id = ${userId} AND created_at >= ${new Date(fromDay)} AND created_at < ${new Date(toDay + DAY_MS)}
      GROUP BY d`,
    db().order.groupBy({
      by: ["serviceId", "status"],
      where: { userId, status: { notIn: ["FAILED"] }, ...created },
      _count: { _all: true },
      _sum: { price: true },
    }),
    db().payment.groupBy({ by: ["status"], where: { userId, ...created }, _count: { _all: true }, _sum: { amount: true } }),
    getBalance(userId),
  ]);

  const count = (statuses: string[]) =>
    byStatus.filter((g) => statuses.includes(g.status)).reduce((s, g) => s + g._count._all, 0);

  const days = new Map(perDay.map((r) => [r.d, { total: Number(r.total), completed: Number(String(r.completed ?? 0)) }]));
  const byDay = Array.from({ length: Math.round((toDay - fromDay) / DAY_MS) + 1 }, (_, i) => {
    const date = new Date(fromDay + i * DAY_MS).toISOString().slice(0, 10);
    return { date, ...(days.get(date) ?? { total: 0, completed: 0 }) };
  });

  const services = await db().service.findMany({
    where: { id: { in: [...new Set(byService.map((g) => g.serviceId))] } },
    select: { id: true, name: true, providerCode: true },
  });
  const serviceRows = services
    .map((s) => {
      const groups = byService.filter((g) => g.serviceId === s.id);
      const completed = groups.filter((g) => g.status === "COMPLETED");
      return {
        name: s.name,
        color: serviceColor(s.providerCode, s.name),
        logo: serviceLogo(s.providerCode),
        total: groups.reduce((n, g) => n + g._count._all, 0),
        completed: completed.reduce((n, g) => n + g._count._all, 0),
        spent: completed.reduce((n, g) => n + (g._sum.price ? toMinor(g._sum.price) : 0), 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  const payCount = (statuses: string[]) => payments.filter((g) => statuses.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
  const paid = payments.find((g) => g.status === "PAID");

  return {
    total: count(["PENDING", "ACTIVE", "SMS_RECEIVED", "COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"]),
    completed: count(["COMPLETED"]),
    cancelled: count(["CANCELLED", "REFUNDED", "EXPIRED"]),
    active: count(["PENDING", "ACTIVE", "SMS_RECEIVED"]),
    smsReceived,
    // Purchases are negative in the ledger; refunds give money back.
    spent: 0 - (totals.PURCHASE ?? 0) - (totals.REFUND ?? 0),
    deposits: totals.DEPOSIT ?? 0,
    balance: wallet.balance,
    payments: {
      paid: paid?._count._all ?? 0,
      paidAmount: paid?._sum.amount ? toMinor(paid._sum.amount) : 0,
      pending: payCount(["PENDING", "PROCESSING"]),
      unpaid: payCount(["FAILED", "CANCELLED", "EXPIRED"]),
    },
    currency: platformCurrency().code,
    byDay,
    byService: serviceRows,
  };
}

