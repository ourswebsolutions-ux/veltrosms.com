"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { MONEY_SCALE, parseAmount } from "@/lib/money";
import { whatsappHref } from "@/lib/whatsapp";
import { createManualTopUpAction } from "@/server/actions/payments";
import type { TopUpResult } from "@/server/services/payment.service";
import type { ManualPaymentDetails, TopUpOptions } from "@/types/account";

const METHODS = [
  { id: "easypaisa", label: "Easypaisa" },
  { id: "jazzcash", label: "JazzCash" },
] as const;
type Method = (typeof METHODS)[number]["id"];

function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The receiving account, with copy buttons. */
export function PaymentAccount({ details }: { details: ManualPaymentDetails }) {
  return (
    <div className="rounded-xl border border-accent/40 bg-accent-tint p-4">
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">Easypaisa / JazzCash</p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
        <dt className="text-sm text-fg-muted">Account name</dt>
        <dd className="text-lg font-semibold">{details.accountName}</dd>
        <dt className="text-sm text-fg-muted">Number</dt>
        <dd className="flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums">
          {details.accountNumber}
          <CopyButton value={details.accountNumber.replace(/\s/g, "")} label="Copy account number" className="size-8" />
        </dd>
      </dl>
    </div>
  );
}

/** How manual top-ups work, with the WhatsApp help action. Opens on the first visit per session. */
export function ManualPaymentHelp({ details, email, autoOpen = true }: { details: ManualPaymentDetails; email: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (window.sessionStorage.getItem("topup-help-seen")) return;
      window.sessionStorage.setItem("topup-help-seen", "1");
    } catch {
      /* storage unavailable: still show it */
    }
    const t = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(t);
  }, [autoOpen]);
  const wa = whatsappHref(details, { email });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Icon name="alert" size={16} /> How to add funds
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="How to add balance"
        footer={
          <>
            {wa && (
              <ButtonLink href={wa} target="_blank" rel="noopener noreferrer" className="!bg-[#25d366] hover:!bg-[#1ebe5a]">
                <Icon name="message" size={18} /> Contact on WhatsApp
              </ButtonLink>
            )}
            <Button variant="muted" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[15px]">
          <PaymentAccount details={details} />
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Send the amount you want to add to the Easypaisa / JazzCash number above.</li>
            <li>Keep the transaction ID (TID) from your payment receipt.</li>
            <li>Submit the top-up request on this page with the amount and the transaction ID.</li>
            <li>Contact us on WhatsApp{details.whatsapp ? ` (${details.whatsapp})` : ""} if you need help.</li>
            <li>Wait while an administrator verifies your payment.</li>
            <li>Your balance is added after approval.</li>
          </ol>
          <Alert tone="info">Payments are verified manually, so crediting isn&apos;t instant.</Alert>
          {details.note && <p className="text-sm text-fg-muted">{details.note}</p>}
        </div>
      </Modal>
    </>
  );
}

/**
 * Manual top-up request: amount, method, transaction ID and an optional
 * note. Submitting only records the request — nothing is credited until an
 * administrator approves it.
 */
export function ManualTopUpForm({ options, balance }: { options: TopUpOptions; balance: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amountInput, setAmountInput] = useState("");
  const [method, setMethod] = useState<Method>("easypaisa");
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);

  const amount = amountInput.trim() ? parseAmount(amountInput.trim().replace(",", ".")) : null;
  const amountError =
    !amountInput.trim()
      ? null
      : amount === null || amount % (MONEY_SCALE / 100) !== 0
        ? "Enter an amount like 10 or 12.50."
        : amount < options.min || amount > options.max
          ? `Enter an amount between ${formatPrice(options.min, options.currency)} and ${formatPrice(options.max, options.currency)}.`
          : null;
  const tidOk = /^[A-Za-z0-9-]{6,40}$/.test(transactionId.trim().replace(/\s+/g, ""));
  const ready = amount !== null && !amountError && tidOk;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      let r: TopUpResult;
      try {
        r = await createManualTopUpAction({ amount: amountInput.trim(), method, transactionId, note: note.trim() || undefined, idempotencyKey: key });
      } catch {
        // Unknown outcome: keep the key so resubmitting can't create a duplicate request.
        setError("We couldn't reach the server. Check your connection and submit again.");
        return;
      }
      if (!r.ok) {
        setError(r.message);
        setKey(newKey());
        return;
      }
      router.push(`/profile/top-up/${r.payment.id}?submitted=1`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-label="Manual top-up request">
      <Field label={`Amount (${options.currency})`} required error={amountError ?? undefined} hint={`From ${formatPrice(options.min, options.currency)} to ${formatPrice(options.max, options.currency)} — the amount you sent.`}>
        {(p) => (
          <Input {...p} value={amountInput} onChange={(e) => setAmountInput(e.target.value)} inputMode="decimal" autoComplete="off" name="amount" placeholder="e.g. 10" className="text-lg font-semibold tabular-nums" />
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Paid with</legend>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 font-medium transition-colors",
                method === m.id ? "border-primary bg-primary-tint/60 text-primary" : "border-line hover:border-primary-tint-border",
              )}
            >
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
              {m.label}
              <span aria-hidden="true" className={cn("flex size-5 items-center justify-center rounded-full border-2", method === m.id ? "border-primary" : "border-line")}>
                {method === m.id && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Transaction ID (TID)"
        required
        error={transactionId && !tidOk ? "Use the transaction ID from your receipt (6–40 letters or digits)." : undefined}
        hint="Shown on your Easypaisa / JazzCash receipt or SMS."
      >
        {(p) => <Input {...p} value={transactionId} onChange={(e) => setTransactionId(e.target.value)} name="transactionId" autoComplete="off" maxLength={60} placeholder="e.g. 12345678901" className="font-mono" />}
      </Field>

      <Field label="Note (optional)" hint="Anything that helps us find your payment, e.g. the sender's number.">
        {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} name="note" rows={2} maxLength={300} />}
      </Field>

      {amount !== null && !amountError && (
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
          After approval your balance will be <b className="tabular-nums">{formatPrice(balance + amount, options.currency)}</b>.
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-[13px] text-fg-muted">Manual verification required: your balance is updated after an administrator confirms the payment.</p>
        <Button type="submit" size="lg" loading={pending} disabled={pending || !ready}>
          Submit top-up request
        </Button>
      </div>
    </form>
  );
}
