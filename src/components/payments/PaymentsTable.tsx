import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatPrice } from "@/lib/format";
import type { PaymentListItem } from "@/types/account";
import { PaymentStatusBadge } from "./PaymentStatus";
import { getT } from "@/i18n/server";
import { DateTime } from "@/components/ui/DateTime";

/** Top-up payments as a table on ≥ md and as stacked rows on phones. */
export async function PaymentsTable({ payments }: { payments: PaymentListItem[] }) {
  const t = await getT();
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>{t("pay.payment")}</Th>
            <Th>{t("pay.method")}</Th>
            <Th>{t("common.status")}</Th>
            <Th className="text-end">{t("pay.fee")}</Th>
            <Th className="text-end">{t("pay.credited")}</Th>
          </tr>
        </THead>
        <TBody>
          {payments.map((p) => (
            <Tr key={p.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap">
                <Link href={`/profile/top-up/${p.id}`} className="font-mono font-medium text-primary hover:underline">
                  {p.reference}
                </Link>
                <span className="block text-xs text-fg-muted">
                  <DateTime iso={p.createdAt} short />
                </span>
              </Td>
              <Td className="text-sm">
                {p.methodLabel}
                {p.transactionId && <bdi className="block font-mono text-xs text-fg-muted">TID {p.transactionId}</bdi>}
                {p.test && (
                  <Badge tone="neutral" className="ms-1.5">
                    {t("pay.test")}
                  </Badge>
                )}
              </Td>
              <Td>
                <PaymentStatusBadge status={p.status} manual={p.manual} />
                {p.manual && p.reviewedAt && (
                  <span className="mt-0.5 block text-xs text-fg-subtle">
                    {t("pay.reviewed")} <DateTime iso={p.reviewedAt} short />
                  </span>
                )}
                {p.rejectionReason && <span className="block max-w-56 text-xs text-danger">{p.rejectionReason}</span>}
              </Td>
              <Td className="text-end text-sm text-fg-muted tabular-nums">{formatPrice(p.fee, p.currency)}</Td>
              <Td className="pe-0 text-end font-medium tabular-nums">{formatPrice(p.amount, p.currency)}</Td>
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
                  {p.transactionId ? (
                    <>
                      {" · "}
                      <bdi>TID {p.transactionId}</bdi>
                    </>
                  ) : (
                    ` · ${t("pay.feeLower")} ${formatPrice(p.fee, p.currency)}`
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-fg-muted">
                {t("pay.submitted")} <DateTime iso={p.createdAt} />
                {p.manual && p.reviewedAt ? (
                  <>
                    {" · "}
                    {t("pay.reviewedLower")} <DateTime iso={p.reviewedAt} />
                  </>
                ) : null}
              </p>
              {p.rejectionReason && <p className="mt-1 text-[13px] text-danger">
                  {t("pay.reason")} <bdi>{p.rejectionReason}</bdi>
                </p>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
