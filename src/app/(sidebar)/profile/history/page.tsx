import type { Metadata } from "next";
import { Money } from "@/components/currency/DisplayCurrency";
import Link from "next/link";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { DateRangeFilter } from "@/components/profile/DateRangeFilter";
import { OrdersTable } from "@/components/profile/OrdersTable";
import { SmsHistoryList } from "@/components/profile/SmsHistoryList";
import { TransactionsTable, TRANSACTION_LABEL } from "@/components/profile/TransactionsTable";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/Tabs";
import { resolveDateRange } from "@/lib/date-range";
import { parseAmount } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getAccountProfile, listTransactions } from "@/server/services/account.service";
import { listOrders, listSmsHistory } from "@/server/services/order.service";
import { listTopUps } from "@/server/services/payment.service";
import type { OrderFilter, TransactionType } from "@/types/account";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 15;
const TX_TYPES = Object.keys(TRANSACTION_LABEL) as TransactionType[];
const ORDER_STATUSES = ["all", "active", "completed", "cancelled"] as const;
const PAYMENT_STATUSES = ["all", "pending", "paid", "unpaid"] as const;
const TABS = ["transactions", "orders", "sms", "payments"] as const;
type Tab = (typeof TABS)[number];

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 100) : undefined);

export default async function HistoryPage({ searchParams }: PageProps<"/profile/history">) {
  const user = await requireUser("/profile/history");
  const sp = await searchParams;

  const tab: Tab = TABS.find((t) => t === one(sp.tab)) ?? "transactions";
  const page = Math.min(10_000, Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1));
  // Validated server-side: presets, or a custom from/to (invalid ranges are reported and ignored).
  const range = resolveDateRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) });
  const fromDate = range.from;
  const toDate = range.to;

  // Transactions filters
  const type = TX_TYPES.find((t) => t === one(sp.type));
  const txStatus = (["pending", "completed", "failed"] as const).find((s) => s === one(sp.status));
  const minRaw = one(sp.min) ?? "";
  const maxRaw = one(sp.max) ?? "";
  const min = minRaw ? parseAmount(minRaw) ?? undefined : undefined;
  const max = maxRaw ? parseAmount(maxRaw) ?? undefined : undefined;

  // Orders filters
  const orderStatus = ORDER_STATUSES.find((s) => s === one(sp.status)) ?? "all";
  const q = one(sp.q);

  // Payments filters
  const paymentStatus = PAYMENT_STATUSES.find((s) => s === one(sp.status)) ?? "all";

  const [profile, orders, transactions, payments, sms] = await Promise.all([
    getAccountProfile(user),
    tab === "orders"
      ? listOrders(user.id, { status: orderStatus as OrderFilter["status"], q, from: fromDate, to: toDate, page, pageSize: PAGE_SIZE })
      : null,
    tab === "transactions"
      ? listTransactions(user.id, {
          types: type ? [type.toUpperCase() as Uppercase<TransactionType>] : undefined,
          status: txStatus?.toUpperCase() as "PENDING" | "COMPLETED" | "FAILED" | undefined,
          from: fromDate,
          to: toDate,
          minAmount: min,
          maxAmount: max,
          page,
          pageSize: PAGE_SIZE,
        })
      : null,
    tab === "payments" ? listTopUps(user.id, { status: paymentStatus, from: fromDate, to: toDate, page, pageSize: PAGE_SIZE }) : null,
    tab === "sms" ? listSmsHistory(user.id, { q, from: fromDate, to: toDate, page, pageSize: PAGE_SIZE }) : null,
  ]);

  const filtered = Boolean(
    range.preset !== "all" ||
      (tab === "orders"
        ? orderStatus !== "all" || q
        : tab === "sms"
          ? q
        : tab === "payments"
          ? paymentStatus !== "all"
          : type || txStatus || min !== undefined || max !== undefined),
  );
  const hrefFor = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page" && v) next.set(k, v);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return `/profile/history${qs ? `?${qs}` : ""}`;
  };
  const clearHref = tab === "transactions" ? "/profile/history" : `/profile/history?tab=${tab}`;
  // Other filters survive a change of date range.
  const keep = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && v && !["range", "from", "to", "page"].includes(k)),
  ) as Record<string, string>;
  // min-w-0 lets native date/number inputs shrink inside the filter grid.
  const field = "h-10 min-w-0 px-3 text-sm";

  return (
    <Card>
      <PageHeader
        title="History"
        description="Your balance movements, orders, received SMS and payments."
        actions={
          <span className="flex items-center gap-3">
            <span className="text-sm text-fg-muted">
              Balance{" "}
              <b className="text-base text-fg tabular-nums">
                <Money amount={profile.balance} currency={profile.currency} variant="both" />
              </b>
            </span>
            <ButtonLink href="/profile/top-up" size="sm" variant="soft">
              Add funds
            </ButtonLink>
          </span>
        }
      />

      <UnderlineTabs
        label="History type"
        activeHref={clearHref}
        items={[
          { href: "/profile/history", label: "Transactions" },
          { href: "/profile/history?tab=orders", label: "Orders" },
          { href: "/profile/history?tab=sms", label: "SMS" },
          { href: "/profile/history?tab=payments", label: "Payments" },
        ]}
        className="mb-4"
      />

      <DateRangeFilter range={range} basePath="/profile/history" keep={keep} showCustom={false} className="mb-3" />

      {/* Plain GET form: filtering works without JavaScript and URLs are shareable. */}
      <form method="get" action="/profile/history" className="mb-5 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Filter history">
        {tab !== "transactions" && <input type="hidden" name="tab" value={tab} />}
        {tab === "sms" ? (
          <>
            <label className="grid gap-1 text-xs text-fg-muted">
              Search
              <Input name="q" placeholder="Service, country or number" defaultValue={q ?? ""} className={field} />
            </label>
            <span className="hidden sm:block 2xl:hidden" />
            <span className="hidden 2xl:block" />
          </>
        ) : tab === "payments" ? (
          <>
            <label className="grid gap-1 text-xs text-fg-muted">
              Status
              <Select
                name="status"
                defaultValue={paymentStatus}
                className="[&_select]:h-10 [&_select]:text-sm"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "pending", label: "Awaiting payment" },
                  { value: "paid", label: "Paid" },
                  { value: "unpaid", label: "Failed / expired / cancelled" },
                ]}
              />
            </label>
            <span className="hidden sm:block 2xl:hidden" />
            <span className="hidden 2xl:block" />
          </>
        ) : tab === "transactions" ? (
          <>
            <label className="grid gap-1 text-xs text-fg-muted">
              Type
              <Select
                name="type"
                defaultValue={type ?? ""}
                className="[&_select]:h-10 [&_select]:text-sm"
                options={[{ value: "", label: "All types" }, ...TX_TYPES.map((t) => ({ value: t, label: TRANSACTION_LABEL[t] }))]}
              />
            </label>
            <label className="grid gap-1 text-xs text-fg-muted">
              Status
              <Select
                name="status"
                defaultValue={txStatus ?? ""}
                className="[&_select]:h-10 [&_select]:text-sm"
                options={[
                  { value: "", label: "All statuses" },
                  { value: "completed", label: "Completed" },
                  { value: "pending", label: "Pending" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-fg-muted">
                Min amount
                <Input name="min" inputMode="decimal" placeholder="0.00" defaultValue={minRaw} className={field} />
              </label>
              <label className="grid gap-1 text-xs text-fg-muted">
                Max amount
                <Input name="max" inputMode="decimal" placeholder="Any" defaultValue={maxRaw} className={field} />
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="grid gap-1 text-xs text-fg-muted">
              Search
              <Input name="q" placeholder="Service, country, number or order ID" defaultValue={q ?? ""} className={field} />
            </label>
            <label className="grid gap-1 text-xs text-fg-muted">
              Status
              <Select
                name="status"
                defaultValue={orderStatus}
                className="[&_select]:h-10 [&_select]:text-sm"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled / refunded" },
                ]}
              />
            </label>
            <span className="hidden 2xl:block" />
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-fg-muted">
            From
            <Input type="date" name="from" defaultValue={range.fromStr ?? ""} className={field} />
          </label>
          <label className="grid gap-1 text-xs text-fg-muted">
            To
            <Input type="date" name="to" defaultValue={range.toStr ?? ""} className={field} />
          </label>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 2xl:col-span-4">
          <Button type="submit" size="sm" className="h-10">
            Apply filters
          </Button>
          {filtered && (
            <Link href={clearHref} className="px-2 text-sm text-primary hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      {transactions &&
        (transactions.items.length === 0 ? (
          <EmptyState
            icon={filtered ? "search" : "history"}
            title={filtered ? "No transactions match your filters" : "No transactions yet"}
            description={filtered ? "Try other filters." : "Top-ups, purchases and refunds will be listed here."}
            action={
              filtered ? <ButtonLink href={clearHref} variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/profile/top-up">Add funds</ButtonLink>
            }
          />
        ) : (
          <>
            <TransactionsTable transactions={transactions.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={transactions.total} hrefFor={hrefFor} />
          </>
        ))}

      {payments &&
        (payments.items.length === 0 ? (
          <EmptyState
            icon={filtered ? "search" : "wallet"}
            title={filtered ? "No payments match your filters" : "No payments yet"}
            description={filtered ? "Try other filters." : "Your top-up payments will be listed here."}
            action={
              filtered ? <ButtonLink href={clearHref} variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/profile/top-up">Add funds</ButtonLink>
            }
          />
        ) : (
          <>
            <PaymentsTable payments={payments.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={payments.total} hrefFor={hrefFor} />
          </>
        ))}

      {sms &&
        (sms.items.length === 0 ? (
          <EmptyState
            icon={filtered ? "search" : "message"}
            title={filtered ? "No SMS match your filters" : "No SMS yet"}
            description={filtered ? "Try other filters." : "Codes and messages you receive on your numbers will be listed here."}
            action={
              filtered ? <ButtonLink href={clearHref} variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/price">Get a number</ButtonLink>
            }
          />
        ) : (
          <>
            <SmsHistoryList messages={sms.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={sms.total} hrefFor={hrefFor} />
          </>
        ))}

      {orders &&
        (orders.items.length === 0 ? (
          <EmptyState
            icon={filtered ? "search" : "inbox"}
            title={filtered ? "No orders match your filters" : "No orders yet"}
            description={filtered ? "Try other filters." : "Numbers you order will be listed here."}
            action={
              filtered ? <ButtonLink href={clearHref} variant="outline">Clear filters</ButtonLink> : <ButtonLink href="/price">Get a number</ButtonLink>
            }
          />
        ) : (
          <>
            <OrdersTable orders={orders.items} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={orders.total} hrefFor={hrefFor} />
          </>
        ))}
    </Card>
  );
}
