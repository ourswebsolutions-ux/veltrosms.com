"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { NumberCard } from "@/components/orders/NumberCard";
import { Modal } from "@/components/ui/Modal";
import { formatPrice, formatQty } from "@/lib/format";
import { requestNumberAction } from "@/server/actions/orders";
import type { OrderActionResult } from "@/server/services/order.service";
import type { Viewer } from "@/types/account";
import type { OfferGroup, PriceTier } from "@/types/catalog";

export type PurchaseIntent = { group: OfferGroup; tier: PriceTier };
export type { Viewer };

/** Random key identifying one purchase attempt (idempotency). */
function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Confirmation step for getting a number. The server re-quotes the price and
 * charges atomically; this dialog only confirms the price the customer saw.
 * After a successful purchase it shows the live activation in place.
 */
export function PurchaseDialog({
  intent,
  viewer,
  onClose,
}: {
  intent: PurchaseIntent | null;
  viewer: Viewer;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OrderActionResult | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  // One key per purchase attempt: double-clicks, resubmits and retries after a
  // lost response all reuse it, so they can't create a second paid order. A
  // new key is only drawn after the server gave a definite "no".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = useMemo(() => (intent ? newKey() : ""), [intent, attempt]);

  const agreedPrice = price ?? intent?.tier.price ?? 0;
  const currency = intent?.group.currency ?? "USD";
  const insufficient = viewer.signedIn && intent !== null && viewer.balance < agreedPrice;
  const after = viewer.signedIn ? viewer.balance - agreedPrice : 0;

  function close() {
    setResult(null);
    setPrice(null);
    onClose();
  }

  function confirm() {
    if (!intent) return;
    setResult(null);
    startTransition(async () => {
      try {
        const r = await requestNumberAction({
          service: intent.group.service.slug,
          country: intent.group.country.id,
          price: agreedPrice,
          idempotencyKey: key,
        });
        setResult(r);
        if (!r.ok) setAttempt((n) => n + 1);
        // The balance changed (charge, or charge + refund): refresh server data.
        router.refresh();
      } catch {
        // Unknown whether the server got it: keep the key so a retry returns
        // the same order instead of buying twice.
        setResult({ ok: false, code: "PROVIDER_ERROR", message: "We couldn't confirm the purchase. Check your connection and press Buy again — you won't be charged twice." });
      }
    });
  }

  const priceChanged = result && !result.ok && result.code === "PRICE_CHANGED" ? result.prices ?? [] : null;
  const bought = result?.ok ? result.order : null;

  return (
    <Modal
      open={intent !== null}
      onClose={close}
      title={bought ? "Your number is ready" : "Get a number"}
      footer={
        bought ? (
          <>
            <ButtonLink href="/profile" variant="muted">
              All my numbers
            </ButtonLink>
            <Button onClick={close}>Done</Button>
          </>
        ) : viewer.signedIn ? (
          <>
            <Button variant="muted" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={confirm} loading={pending} disabled={pending || insufficient}>
              {`Buy for ${formatPrice(agreedPrice, currency)}`}
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="outline">
              Log in
            </ButtonLink>
            <ButtonLink href="/register">Create account</ButtonLink>
          </>
        )
      }
    >
      {intent && bought ? (
        <div className="space-y-3">
          <Alert tone="success">
            Enter this number on {bought.service.name}. The code appears here and in your active numbers as soon as the
            SMS arrives. If no SMS arrives, cancel it to get the charge back.
          </Alert>
          <NumberCard order={bought} />
        </div>
      ) : intent ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
            <dt className="text-fg-muted">Service</dt>
            <dd className="flex items-center gap-2 font-medium">
              <ServiceAvatar name={intent.group.service.name} color={intent.group.service.color} size={22} />
              {intent.group.service.name}
            </dd>
            <dt className="text-fg-muted">Country</dt>
            <dd className="flex items-center gap-2 font-medium">
              <CountryFlag iso2={intent.group.country.iso2} />
              {intent.group.country.name}
            </dd>
            <dt className="text-fg-muted">Price</dt>
            <dd className="font-semibold text-primary">{formatPrice(agreedPrice, currency)}</dd>
            <dt className="text-fg-muted">Available</dt>
            <dd>{formatQty(intent.tier.available)}</dd>
            {viewer.signedIn && (
              <>
                <dt className="text-fg-muted">Your balance</dt>
                <dd className={insufficient ? "font-semibold text-danger tabular-nums" : "font-medium tabular-nums"}>
                  {formatPrice(viewer.balance, viewer.currency)}
                </dd>
                {!insufficient && (
                  <>
                    <dt className="text-fg-muted">After purchase</dt>
                    <dd className="font-medium tabular-nums">{formatPrice(after, viewer.currency)}</dd>
                  </>
                )}
              </>
            )}
          </dl>

          {!viewer.signedIn ? (
            <Alert>Log in or create an account to get a number. You only pay for activations that receive a code.</Alert>
          ) : insufficient ? (
            <Alert
              tone="warning"
              title="Not enough balance"
              action={
                <ButtonLink href="/profile/top-up" size="sm" variant="outline">
                  Add funds
                </ButtonLink>
              }
            >
              This number costs {formatPrice(agreedPrice, currency)}; you need{" "}
              {formatPrice(agreedPrice - (viewer.signedIn ? viewer.balance : 0), currency)} more. Top up your balance to buy it.
            </Alert>
          ) : priceChanged ? (
            <Alert
              tone="warning"
              title="The price has changed"
              action={
                priceChanged.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => { setPrice(priceChanged[0]); setResult(null); }}>
                    {`Use ${formatPrice(priceChanged[0], currency)}`}
                  </Button>
                )
              }
            >
              {priceChanged.length ? "Confirm the new price to continue." : "This offer is no longer available."}
            </Alert>
          ) : result && !result.ok ? (
            <Alert tone={result.code === "INSUFFICIENT_FUNDS" || result.code === "NO_NUMBERS" ? "warning" : "error"}>
              {result.message}
            </Alert>
          ) : (
            <p className="text-[13px] text-fg-muted">
              You&apos;re charged now. If no SMS arrives, cancel the number and the charge is returned to your balance.
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
