/** Admin-panel DTOs (server → admin UI). Never contain secrets or password data. */
import type { OrderStatus, PaymentStatus, TransactionType } from "./account";

export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  balance: number;
  currency: string;
  orders: number;
  /** Net spending on numbers (purchases − refunds), minor units. */
  spent: number;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminUserDetail = AdminUserRow & {
  lastActiveAt: string | null;
  activeSessions: number;
  hasApiKey: boolean;
  suspension: { reason: string | null; at: string; by: string | null } | null;
  totals: { deposits: number; purchases: number; refunds: number; adjustments: number };
  orderCounts: { total: number; completed: number; active: number; cancelled: number; failed: number };
  paymentCounts: { pending: number; approved: number; rejected: number; totalPaid: number };
  /** Admin actions on this account (from the audit log). */
  history: { id: string; action: string; description: string | null; actorEmail: string | null; success: boolean; createdAt: string }[];
  /** Recent security events (logins, password/email changes). */
  security: { id: string; event: string; level: string; createdAt: string }[];
};

export type AdminOrderRow = {
  id: string;
  user: { id: string; email: string };
  service: { name: string; slug: string };
  country: { name: string; iso2: string | null };
  phoneNumber: string | null;
  status: OrderStatus;
  price: number;
  currency: string;
  providerActivationId: string | null;
  smsCount: number;
  provider: string;
  completedAt: string | null;
  createdAt: string;
};

export type AdminPaymentRow = {
  id: string;
  reference: string;
  user: { id: string; email: string };
  provider: string;
  method: string;
  status: PaymentStatus;
  amount: number;
  fee: number;
  total: number;
  currency: string;
  providerPaymentId: string | null;
  needsReview: boolean;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Manual top-ups: who reviewed it, when, and why it was rejected. */
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type AdminLedgerRow = {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
};

export type AuditRow = {
  id: string;
  actorEmail: string | null;
  action: string;
  description: string | null;
  targetType: string | null;
  targetId: string | null;
  success: boolean;
  metadata: unknown;
  createdAt: string;
};
