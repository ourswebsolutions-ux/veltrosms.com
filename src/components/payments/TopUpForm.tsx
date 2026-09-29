"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { MONEY_SCALE, parseAmount, toMinor, topUpFeeFor } from "@/lib/money";
import { createTopUpAction } from "@/server/actions/payments";
import type { TopUpResult } from "@/server/services/payment.service";
import type { TopUpOptions } from "@/types/account";

const KIND_ICON: Record<string, IconName> = {
  card: "wallet",
  bank_transfer: "globe",
  local: "phone",
  crypto: "lock",
  wallet: "wallet",
  test: "cpu",
};

function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const unitsLabel = (minor: number) => String(minor / MONEY_SCALE);

/**
 * Add-funds form: amount (presets or custom), payment method and a live
 * summary. The preview mirrors the server's fee rule; the server recomputes
 * and validates everything when the payment is created.
 */
export function TopUpForm({ options, balance }: { options: TopUpOptions; balance: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amountInput, setAmountInput] = useState(() =>
    unitsLabel(options.presets.find((p) => p === 10 * MONEY_SCALE) ?? options.presets[0] ?? options.min),
  );
  const [method, setMethod] = useState(options.methods[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  // One key per attempt: a double submit or a retry after a lost response
  // returns the same payment instead of starting a second one.
  const [key, setKey] = useState(newKey);

  const feeBps = toMinor(options.feePercent) / 100;
  const amount = parseAmount(amountInput.trim().replace(",", "."));
  const invalid =
    amount === null || amount % (MONEY_SCALE / 100) !== 0
      ? "Enter an amount like 10 or 12.50."
      : amount < options.min || amount > options.max
        ? `Enter an amount between ${formatPrice(options.min, options.currency)} and ${formatPrice(options.max, options.currency)}.`
        : null;
  const quote = useMemo(() => {
    if (invalid || amount === null) return null;
    const fee = topUpFeeFor(amount, feeBps, options.feeFixed);
    return { fee, total: amount + fee };
  }, [amount, invalid, feeBps, options.feeFixed]);
  const hasFee = feeBps > 0 || options.feeFixed > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || !method) return;
    setError(null);
    startTransition(async () => {
      let r: TopUpResult;
      try {
        r = await createTopUpAction({ amount: amountInput.trim(), method, idempotencyKey: key });
      } catch {
        // Unknown whether it was created: keep the key so a retry can't create a second payment.
        setError("We couldn't reach the server. Check your connection and try again.");
        return;
      }
      if (!r.ok) {
        setError(r.message);
        setKey(newKey());
        return;
      }
      if (r.redirectUrl) window.location.assign(r.redirectUrl);
      else router.push(`/profile/top-up/${r.payment.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" aria-label="Add funds">
      {options.test && (
        <Alert tone="warning" title="Test mode">
          This payment provider is in test mode: nothing is charged and no real money moves.
        </Alert>
      )}

      <fieldset>
        <legend className="mb-2.5 text-[15px] font-semibold">Amount</legend>
        {options.presets.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {options.presets.map((p) => {
              const selected = amount === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAmountInput(unitsLabel(p))}
                  className={cn(
                    "h-11 rounded-lg border text-[15px] font-semibold tabular-nums transition-colors",
                    selected
                      ? "border-primary bg-primary-tint text-primary"
                      : "border-line bg-surface-muted text-fg hover:border-primary-tint-border",
                  )}
                >
                  {formatPrice(p, options.currency)}
                </button>
              );
            })}
          </div>
        )}
        <label className="block">
          <span className="sr-only">Custom amount</span>
          <span className="relative block">
            <input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              name="amount"
              aria-invalid={Boolean(invalid && amountInput) || undefined}
              aria-describedby="amount-help"
              className={cn(
                "h-12 w-full rounded-lg border bg-surface-muted pr-16 pl-4 text-lg font-semibold tabular-nums outline-none focus:border-primary",
                invalid && amountInput ? "border-danger" : "border-line",
              )}
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-fg-muted">
              {options.currency}
            </span>
          </span>
        </label>
        <p id="amount-help" className={cn("mt-1.5 text-[13px]", invalid && amountInput ? "text-danger" : "text-fg-muted")}>
          {invalid && amountInput
            ? invalid
            : `From ${formatPrice(options.min, options.currency)} to ${formatPrice(options.max, options.currency)}.`}
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-[15px] font-semibold">Payment method</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.methods.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                method === m.id ? "border-primary bg-primary-tint/60" : "border-line hover:border-primary-tint-border",
              )}
            >
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  method === m.id ? "bg-primary text-white" : "bg-surface-muted text-fg-muted",
                )}
              >
                <Icon name={KIND_ICON[m.kind] ?? "wallet"} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{m.label}</span>
                {m.description && <span className="block text-[13px] text-fg-muted">{m.description}</span>}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  method === m.id ? "border-primary" : "border-line",
                )}
              >
                {method === m.id && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-xl bg-surface-muted p-4 text-[15px]">
        <dt className="text-fg-muted">Added to your balance</dt>
        <dd className="text-right font-medium tabular-nums">{amount !== null && !invalid ? formatPrice(amount, options.currency) : "—"}</dd>
        <dt className="text-fg-muted">
          Payment fee
          {hasFee && (
            <span className="text-fg-subtle">
              {" "}
              ({options.feePercent}%{options.feeFixed > 0 ? ` + ${formatPrice(options.feeFixed, options.currency)}` : ""})
            </span>
          )}
        </dt>
        <dd className="text-right tabular-nums">{quote ? (quote.fee ? formatPrice(quote.fee, options.currency) : "Free") : "—"}</dd>
        <dt className="border-t border-line pt-2 font-semibold">Total to pay</dt>
        <dd className="border-t border-line pt-2 text-right text-lg font-semibold text-primary tabular-nums">
          {quote ? formatPrice(quote.total, options.currency) : "—"}
        </dd>
        <dt className="text-[13px] text-fg-muted">Balance after top-up</dt>
        <dd className="text-right text-[13px] text-fg-muted tabular-nums">
          {amount !== null && !invalid ? formatPrice(balance + amount, options.currency) : "—"}
        </dd>
      </dl>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-[13px] text-fg-muted">
          You&apos;ll finish the payment on the payment provider&apos;s page. Your balance is credited once the provider
          confirms the payment.
        </p>
        <Button type="submit" size="lg" loading={pending} disabled={pending || Boolean(invalid) || !method}>
          {quote ? `Continue to payment · ${formatPrice(quote.total, options.currency)}` : "Continue to payment"}
        </Button>
      </div>
    </form>
  );
}
