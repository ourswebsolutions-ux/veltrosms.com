import Link from "next/link";
import { Money } from "@/components/currency/DisplayCurrency";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import type { TransactionListItem, TransactionType } from "@/types/account";
import { getT } from "@/i18n/server";
import type { Translator } from "@/i18n/translate";
import { TRANSACTION_STATUS, TRANSACTION_TYPE } from "@/i18n/labels";
import { DateTime } from "@/components/ui/DateTime";

/** English labels, used by the admin panel (customers see translated labels). */
export const TRANSACTION_LABEL: Record<TransactionType, string> = {
  deposit: "Top-up",
  purchase: "Number purchase",
  refund: "Refund",
  adjustment: "Adjustment",
};

/** Where a ledger entry came from, linked to the caller's own order/payment. */
function Source({ tx, t }: { tx: TransactionListItem; t: Translator }) {
  if (tx.orderId) {
    return (
      <Link href={`/profile/orders/${tx.orderId}`} className="font-mono text-xs text-primary hover:underline">
        <bdi>{t("tx.order", { id: tx.orderId.slice(0, 8) })}</bdi>
      </Link>
    );
  }
  if (tx.paymentId) {
    return (
      <Link href={`/profile/top-up/${tx.paymentId}`} className="text-xs text-primary hover:underline">
        {t("tx.paymentDetails")}
      </Link>
    );
  }
  return null;
}

function Amount({ value, currency }: { value: number; currency: string }) {
  return (
    <Money
      amount={value}
      currency={currency}
      signed
      variant="stack"
      className={cn("font-medium tabular-nums", value >= 0 ? "text-success" : "text-fg")}
    />
  );
}

/** Balance ledger as a table on ≥ md and as stacked rows on phones. */
export async function TransactionsTable({ transactions }: { transactions: TransactionListItem[] }) {
  const t = await getT();
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>{t("common.date")}</Th>
            <Th>{t("common.type")}</Th>
            <Th>{t("common.details")}</Th>
            <Th className="text-end">{t("common.amount")}</Th>
            <Th className="text-end">{t("common.balance")}</Th>
          </tr>
        </THead>
        <TBody>
          {transactions.map((row) => (
            <Tr key={row.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap text-fg-muted">
                <DateTime iso={row.createdAt} short />
              </Td>
              <Td className="font-medium whitespace-nowrap">{t(TRANSACTION_TYPE[row.type])}</Td>
              <Td className="text-fg-muted">
                <bdi>{row.description ? t.server(row.description) : "—"}</bdi>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                  <Source tx={row} t={t} />
                  {row.status !== "completed" && <span className="text-warning">{t(TRANSACTION_STATUS[row.status])}</span>}
                </span>
              </Td>
              <Td className="text-end">
                <Amount value={row.amount} currency={row.currency} />
              </Td>
              <Td className="pe-0 text-end tabular-nums text-fg-muted">
                <Money amount={row.balanceAfter} currency={row.currency} variant="stack" className="items-end" />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <ul className="divide-y divide-line md:hidden">
        {transactions.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{t(TRANSACTION_TYPE[row.type])}</p>
              <p className="truncate text-[13px] text-fg-muted">
                <bdi>{row.description ? t.server(row.description) : "—"}</bdi>
              </p>
              <p className="flex flex-wrap gap-x-2">
                <Source tx={row} t={t} />
                {row.status !== "completed" && <span className="text-xs text-warning">{t(TRANSACTION_STATUS[row.status])}</span>}
              </p>
              <p className="text-xs text-fg-subtle">
                <DateTime iso={row.createdAt} />
              </p>
            </div>
            <div className="shrink-0 text-end">
              <Amount value={row.amount} currency={row.currency} />
              <p className="text-xs text-fg-subtle tabular-nums">
                <Money amount={row.balanceAfter} currency={row.currency} variant="stack" className="items-end" />
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
