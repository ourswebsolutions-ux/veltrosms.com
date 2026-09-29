import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopUpReviewForms } from "@/components/admin/AdminForms";
import { KeyValues } from "@/components/admin/AdminParts";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatus";
import { Alert } from "@/components/ui/Alert";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime, formatPrice } from "@/lib/format";
import { adminApproveTopUpAction, adminRejectTopUpAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { getAdminPayment } from "@/server/admin/orders";

export const metadata: Metadata = { title: "Top-up request" };

export default async function AdminTopUpPage({ params }: PageProps<"/admin/topups/[id]">) {
  const { id } = await params;
  const admin = await requireAdminPage(`/admin/topups/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await getAdminPayment(id);
  if (!data || data.payment.provider !== "manual") notFound();
  const p = data.payment;
  const amount = formatPrice(p.amount, p.currency);
  const method = p.method === "jazzcash" ? "JazzCash" : "Easypaisa";
  const own = p.user.id === admin.id;

  return (
    <Card>
      <Breadcrumbs items={[{ label: "Top-ups", href: "/admin/topups" }, { label: p.reference }]} className="mb-3" />
      <PageHeader title={`${amount} via ${method}`} description={`Request ${p.reference}`} actions={<PaymentStatusBadge status={p.status} manual />} />
      <KeyValues
        rows={[
          ["Customer", <Link key="u" href={`/admin/users/${p.user.id}`} className="text-primary hover:underline">{p.user.email}</Link>],
          ["Amount", <b key="a" className="tabular-nums">{amount}</b>],
          ["Method", method],
          [
            "Transaction ID",
            <span key="t" className="inline-flex items-center gap-1 font-mono">
              {p.providerPaymentId}
              {p.providerPaymentId && <CopyButton value={p.providerPaymentId} label="Copy transaction ID" className="size-6" />}
            </span>,
          ],
          ["Customer note", data.customerNote ?? "—"],
          ["Payment proof", "Not collected — verify with the transaction ID in the account statement"],
          ["Submitted", formatDateTime(p.createdAt)],
          ...(data.manualReview
            ? ([
                [p.status === "rejected" ? "Rejected" : "Approved", `${formatDateTime(data.manualReview.at)} by ${data.manualReview.by}`],
                ...(data.manualReview.rejectionReason ? ([["Reason", data.manualReview.rejectionReason]] as [string, string][]) : []),
              ] as [string, string][])
            : []),
          ["Wallet credit", data.ledger.length ? `+${formatPrice(data.ledger[0].amount, p.currency)} on ${formatDateTime(data.ledger[0].createdAt)}` : "None"],
        ]}
      />
      <div className="mt-5 border-t border-line pt-4">
        {p.status === "paid" ? (
          <Alert tone="success" title="Approved">
            {amount} was credited to the customer&apos;s wallet{data.manualReview ? ` by ${data.manualReview.by}` : ""}. It can&apos;t be approved again.
          </Alert>
        ) : p.status === "rejected" ? (
          <Alert tone="error" title="Rejected">
            Nothing was credited. The customer can see the reason: {data.manualReview?.rejectionReason ?? "—"}
          </Alert>
        ) : p.status !== "pending" ? (
          <p className="text-sm text-fg-muted">This request has been reviewed. It can&apos;t be approved or rejected again.</p>
        ) : own ? (
          <Alert tone="warning">This is your own request. Another administrator must review it.</Alert>
        ) : (
          <TopUpReviewForms
            approve={adminApproveTopUpAction}
            reject={adminRejectTopUpAction}
            paymentId={p.id}
            summary={`${amount} will be credited to ${p.user.email} for ${method} transaction ${p.providerPaymentId}.`}
          />
        )}
      </div>
    </Card>
  );
}
