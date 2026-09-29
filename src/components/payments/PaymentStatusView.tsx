"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPrice } from "@/lib/format";
import { whatsappHref } from "@/lib/whatsapp";
import { verifyTopUpAction } from "@/server/actions/payments";
import type { ManualPaymentDetails, PaymentListItem } from "@/types/account";
import { PaymentStatusBadge } from "./PaymentStatus";

const POLL_MS = 4_000;
/** Stop automatic polling after this long; "Check now" still works. */
const POLL_FOR_MS = 15 * 60_000;

const OPEN = ["pending", "processing"];

const VIEW: Record<PaymentListItem["status"], { icon: IconName; tone: string; title: string; body: string }> = {
  pending: {
    icon: "history",
    tone: "bg-primary-tint text-primary",
    title: "Waiting for your payment",
    body: "Finish the payment on the provider's page. This page updates by itself once the provider confirms it.",
  },
  processing: {
    icon: "refresh",
    tone: "bg-primary-tint text-primary",
    title: "Payment is being processed",
    body: "The provider is confirming your payment. Your balance is credited automatically — you can safely leave this page.",
  },
  paid: {
    icon: "checkCircle",
    tone: "bg-success-tint text-success",
    title: "Funds added",
    body: "The payment was confirmed and your balance has been credited.",
  },
  failed: {
    icon: "alert",
    tone: "bg-danger-tint text-danger",
    title: "Payment failed",
    body: "The payment didn't go through and your balance was not credited. You can try again.",
  },
  cancelled: {
    icon: "close",
    tone: "bg-surface-muted text-fg-muted",
    title: "Payment cancelled",
    body: "The payment was cancelled and your balance was not credited.",
  },
  expired: {
    icon: "history",
    tone: "bg-surface-muted text-fg-muted",
    title: "Payment session expired",
    body: "This payment wasn't completed in time and your balance was not credited. Start a new top-up to add funds.",
  },
  refunded: {
    icon: "refresh",
    tone: "bg-warning/15 text-[#a37c00] dark:text-warning",
    title: "Payment refunded",
    body: "The provider returned this payment. Contact support if your balance needs a correction.",
  },
  rejected: {
    icon: "alert",
    tone: "bg-danger-tint text-danger",
    title: "Top-up request rejected",
    body: "Your top-up request was rejected. Please check the provided details or contact support.",
  },
};

/** Manual (admin-verified) requests: accurate wording, no gateway language. */
const MANUAL_VIEW: Partial<Record<PaymentListItem["status"], (typeof VIEW)["pending"]>> = {
  pending: {
    icon: "history",
    tone: "bg-primary-tint text-primary",
    title: "Awaiting manual verification",
    body: "Top-up request submitted successfully. Your balance will be updated after manual verification.",
  },
  paid: {
    icon: "checkCircle",
    tone: "bg-success-tint text-success",
    title: "Top-up approved",
    body: "Your top-up has been approved and your wallet has been credited.",
  },
};

/**
 * Result page for one top-up. The status shown always comes from the server,
 * which checks with the payment provider — arriving here from the provider's
 * redirect is not treated as proof of payment.
 */
export function PaymentStatusView({
  payment: initial,
  balance,
  help,
  email,
}: {
  payment: PaymentListItem;
  balance: number;
  /** Manual payment contact, for the WhatsApp help button. */
  help?: ManualPaymentDetails | null;
  email?: string;
}) {
  const router = useRouter();
  const [payment, setPayment] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const open = OPEN.includes(payment.status);
  const wasOpen = useRef(open);

  // Server re-renders (router.refresh) bring newer data.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setPayment(initial);
  }

  useEffect(() => {
    if (!open) return;
    const started = Date.now();
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || Date.now() - started > POLL_FOR_MS) return;
      try {
        const res = await fetch(`/api/payments/${payment.id}`, { cache: "no-store" });
        if (res.ok && !stopped) setPayment(((await res.json()) as { payment: PaymentListItem }).payment);
      } catch {
        /* transient: next tick */
      }
    };
    // Manual reviews take minutes to hours: poll gently.
    const id = window.setInterval(tick, payment.manual ? 15_000 : POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [open, payment.id, payment.manual]);

  // Once the payment closes, re-render server data (balance in the header, lists).
  useEffect(() => {
    if (wasOpen.current && !open) router.refresh();
    wasOpen.current = open;
  }, [open, router]);

  function checkNow() {
    setNotice(null);
    startTransition(async () => {
      try {
        const r = await verifyTopUpAction(payment.id);
        if (r.ok) setPayment(r.payment);
        else setNotice(r.message);
      } catch {
        setNotice("We couldn't reach the server. Please try again.");
      }
    });
  }

  const v = (payment.manual && MANUAL_VIEW[payment.status]) || VIEW[payment.status];
  const wa = help ? whatsappHref(help, { email, reference: payment.reference }) : null;
  const money = (n: number) => formatPrice(n, payment.currency);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center" aria-live="polite">
        <span className={cn("flex size-16 items-center justify-center rounded-full", v.tone)}>
          <Icon name={v.icon} size={30} className={payment.status === "processing" ? "animate-spin [animation-duration:2.5s]" : undefined} />
        </span>
        <h1 className="mt-3 text-2xl font-semibold">{v.title}</h1>
        {payment.status === "paid" && <p className="mt-1 text-3xl font-bold text-success tabular-nums">+{money(payment.amount)}</p>}
        <p className="mt-2 max-w-md text-[15px] text-fg-muted">{v.body}</p>
        {payment.status === "rejected" && payment.rejectionReason && (
          <p className="mt-3 max-w-md rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">Reason: {payment.rejectionReason}</p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-xl bg-surface-muted p-4 text-[15px]">
        <dt className="text-fg-muted">Status</dt>
        <dd className="flex justify-end">
          <PaymentStatusBadge status={payment.status} manual={payment.manual} />
        </dd>
        <dt className="text-fg-muted">Reference</dt>
        <dd className="flex items-center justify-end gap-1 font-mono">
          {payment.reference}
          <CopyButton value={payment.reference} label="Copy reference" className="size-6" />
        </dd>
        {payment.transactionId && (
          <>
            <dt className="text-fg-muted">Transaction ID</dt>
            <dd className="text-right font-mono break-all">{payment.transactionId}</dd>
          </>
        )}
        <dt className="text-fg-muted">{payment.manual ? "Paid with" : "Method"}</dt>
        <dd className="text-right">
          {payment.methodLabel}
          {payment.test && (
            <Badge tone="neutral" className="ml-1.5">
              Test
            </Badge>
          )}
        </dd>
        <dt className="text-fg-muted">Amount</dt>
        <dd className="text-right tabular-nums">{money(payment.amount)}</dd>
        <dt className="text-fg-muted">Fee</dt>
        <dd className="text-right tabular-nums">{payment.fee ? money(payment.fee) : "Free"}</dd>
        <dt className="text-fg-muted">Total</dt>
        <dd className="text-right font-semibold tabular-nums">{money(payment.total)}</dd>
        <dt className="text-fg-muted">Submitted</dt>
        <dd className="text-right" suppressHydrationWarning>
          {formatDateTime(payment.createdAt)}
        </dd>
        {(payment.reviewedAt ?? payment.paidAt) && (
          <>
            <dt className="text-fg-muted">{payment.status === "rejected" ? "Rejected" : payment.manual ? "Approved" : "Paid"}</dt>
            <dd className="text-right" suppressHydrationWarning>
              {formatDateTime((payment.reviewedAt ?? payment.paidAt)!)}
            </dd>
          </>
        )}
        <dt className="border-t border-line pt-2.5 text-fg-muted">Your balance</dt>
        <dd className="border-t border-line pt-2.5 text-right font-semibold tabular-nums">{formatPrice(balance, payment.currency)}</dd>
      </dl>

      {notice && <Alert tone="warning">{notice}</Alert>}

      <div className="flex flex-wrap justify-center gap-2">
        {payment.status === "paid" ? (
          <>
            <ButtonLink href="/price">Buy a number</ButtonLink>
            <ButtonLink href="/profile/top-up" variant="outline">
              Add more funds
            </ButtonLink>
          </>
        ) : payment.manual && open ? (
          <>
            {wa && (
              <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" className="!bg-[#25d366] hover:!bg-[#1ebe5a]">
                <Icon name="message" size={16} /> Contact on WhatsApp
              </ButtonLink>
            )}
            <Button variant="outline" onClick={checkNow} loading={pending} disabled={pending}>
              <Icon name="refresh" size={16} /> Refresh status
            </Button>
          </>
        ) : payment.manual ? (
          <>
            <ButtonLink href="/profile/top-up">{payment.status === "rejected" ? "Submit a new request" : "Add more funds"}</ButtonLink>
            {wa && payment.status === "rejected" && (
              <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" variant="outline">
                <Icon name="message" size={16} /> Contact support
              </ButtonLink>
            )}
          </>
        ) : open ? (
          <>
            {payment.checkoutUrl && (
              <ButtonLink href={payment.checkoutUrl}>
                Continue to payment <Icon name="arrowRight" size={16} />
              </ButtonLink>
            )}
            <Button variant="outline" onClick={checkNow} loading={pending} disabled={pending}>
              <Icon name="refresh" size={16} /> Check status
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/profile/top-up">{payment.status === "refunded" ? "Add funds" : "Try again"}</ButtonLink>
            <Button variant="outline" onClick={checkNow} loading={pending} disabled={pending}>
              <Icon name="refresh" size={16} /> Check again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
