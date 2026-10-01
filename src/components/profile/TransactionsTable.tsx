import Link from "next/link";
import { Money } from "@/components/currency/DisplayCurrency";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatDateTime, formatShortDateTime } from "@/lib/format";
import type { TransactionListItem, TransactionType } from "@/types/account";

export const TRANSACTION_LABEL: Record<TransactionType, string> = {
  deposit: "Top-up",
  purchase: "Number purchase",
  refund: "Refund",
  adjustment: "Adjustment",
};

const STATUS_LABEL = { completed: "Completed", pending: "Pending", failed: "Failed" } as const;

/** Where a ledger entry came from, linked to the caller's own order/payment. */
function Source({ t }: { t: TransactionListItem }) {
  if (t.orderId) {
    return (
      <Link href={`/profile/orders/${t.orderId}`} className="font-mono text-xs text-primary hover:underline">
        Order #{t.orderId.slice(0, 8)}
      </Link>
    );
  }
  if (t.paymentId) {
    return (
      <Link href={`/profile/top-up/${t.paymentId}`} className="text-xs text-primary hover:underline">
        Payment details
      </Link>
    );
  }
  return null;
}

function Amount({ value, currency }: { value: number; currency: string }) {
  return (
    <Money amount={value} currency={currency} signed variant="stack" className={cn("font-medium tabular-nums", value >= 0 ? "text-success" : "text-fg")} />
  );
}

/** Balance ledger as a table on ≥ md and as stacked rows on phones. */
export function TransactionsTable({ transactions }: { transactions: TransactionListItem[] }) {
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Details</Th>
            <Th className="text-right">Amount</Th>
            <Th className="text-right">Balance</Th>
          </tr>
        </THead>
        <TBody>
          {transactions.map((t) => (
            <Tr key={t.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap text-fg-muted">{formatShortDateTime(t.createdAt)}</Td>
              <Td className="font-medium whitespace-nowrap">{TRANSACTION_LABEL[t.type]}</Td>
              <Td className="text-fg-muted">
                {t.description ?? "—"}
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <Source t={t} />
                  {t.status !== "completed" && <span className="text-warning">{STATUS_LABEL[t.status]}</span>}
                </span>
              </Td>
              <Td className="text-right">
                <Amount value={t.amount} currency={t.currency} />
              </Td>
              <Td className="pr-0 text-right tabular-nums text-fg-muted">
                <Money amount={t.balanceAfter} currency={t.currency} variant="stack" className="items-end" />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <ul className="divide-y divide-line md:hidden">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{TRANSACTION_LABEL[t.type]}</p>
              <p className="truncate text-[13px] text-fg-muted">{t.description ?? "—"}</p>
              <p className="flex flex-wrap gap-x-2">
                <Source t={t} />
                {t.status !== "completed" && <span className="text-xs text-warning">{STATUS_LABEL[t.status]}</span>}
              </p>
              <p className="text-xs text-fg-subtle">{formatDateTime(t.createdAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <Amount value={t.amount} currency={t.currency} />
              <p className="text-xs text-fg-subtle tabular-nums">
                <Money amount={t.balanceAfter} currency={t.currency} variant="stack" className="items-end" />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
