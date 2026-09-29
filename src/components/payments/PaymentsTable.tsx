import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatDateTime, formatPrice, formatShortDateTime } from "@/lib/format";
import type { PaymentListItem } from "@/types/account";
import { PaymentStatusBadge } from "./PaymentStatus";

/** Top-up payments as a table on ≥ md and as stacked rows on phones. */
export function PaymentsTable({ payments }: { payments: PaymentListItem[] }) {
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>Payment</Th>
            <Th>Method</Th>
            <Th>Status</Th>
            <Th className="text-right">Fee</Th>
            <Th className="text-right">Credited</Th>
          </tr>
        </THead>
        <TBody>
          {payments.map((p) => (
            <Tr key={p.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap">
                <Link href={`/profile/top-up/${p.id}`} className="font-mono font-medium text-primary hover:underline">
                  {p.reference}
                </Link>
                <span className="block text-xs text-fg-muted">{formatShortDateTime(p.createdAt)}</span>
              </Td>
              <Td className="text-sm">
                {p.methodLabel}
                {p.transactionId && <span className="block font-mono text-xs text-fg-muted">TID {p.transactionId}</span>}
                {p.test && (
                  <Badge tone="neutral" className="ml-1.5">
                    Test
                  </Badge>
                )}
              </Td>
              <Td>
                <PaymentStatusBadge status={p.status} manual={p.manual} />
                {p.manual && p.reviewedAt && <span className="mt-0.5 block text-xs text-fg-subtle">Reviewed {formatShortDateTime(p.reviewedAt)}</span>}
                {p.rejectionReason && <span className="block max-w-56 text-xs text-danger">{p.rejectionReason}</span>}
              </Td>
              <Td className="text-right text-sm text-fg-muted tabular-nums">{formatPrice(p.fee, p.currency)}</Td>
              <Td className="pr-0 text-right font-medium tabular-nums">{formatPrice(p.amount, p.currency)}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <ul className="space-y-2 md:hidden">
        {payments.map((p) => (
          <li key={p.id}>
            <Link href={`/profile/top-up/${p.id}`} className="block rounded-xl border border-line p-3 hover:border-primary-tint-border">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium text-primary">{p.reference}</span>
                <span className="font-semibold tabular-nums">{formatPrice(p.amount, p.currency)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-fg-muted">
                <PaymentStatusBadge status={p.status} manual={p.manual} />
                <span>
                  {p.methodLabel}
                  {p.transactionId ? ` · TID ${p.transactionId}` : ` · fee ${formatPrice(p.fee, p.currency)}`}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-fg-muted">
                Submitted {formatDateTime(p.createdAt)}
                {p.manual && p.reviewedAt ? ` · reviewed ${formatDateTime(p.reviewedAt)}` : ""}
              </p>
              {p.rejectionReason && <p className="mt-1 text-[13px] text-danger">Reason: {p.rejectionReason}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
