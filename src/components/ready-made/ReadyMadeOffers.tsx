"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChargeRows, Money, useDisplayCurrency } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { PricePill } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { formatPrice } from "@/lib/format";
import { purchaseReadyMadeAction } from "@/server/actions/ready-made";
import type { Viewer } from "@/types/account";
import type { ReadyMadeOfferView, ReadyMadePurchaseResult } from "@/types/ready-made";

/** Random key identifying one purchase attempt (idempotency). */
function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ready Made offers as cards; Purchase opens a confirmation dialog. */
export function ReadyMadeOffers({ offers, viewer }: { offers: ReadyMadeOfferView[]; viewer: Viewer }) {
  const [selected, setSelected] = useState<ReadyMadeOfferView | null>(null);
  const { convert } = useDisplayCurrency();

  if (offers.length === 0) {
    return (
      <EmptyState
        icon="box"
        title="No Ready Made accounts available right now"
        description="Please check back later, or get a virtual number for your service instead."
        action={
          <ButtonLink href="/price" variant="outline">
            Browse virtual numbers
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-4 rounded-xl border border-line bg-surface-muted/60 p-4">
            <div className="flex items-center gap-3">
              <ServiceAvatar name={o.service.name} color={o.service.color} logo={o.service.logo} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold">{o.service.name}</p>
                <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                  {o.country ? (
                    <>
                      <CountryFlag iso2={o.country.iso2} size={16} />
                      {o.country.name}
                    </>
                  ) : (
                    <>
                      <Icon name="globe" size={15} />
                      All countries
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <PricePill>
                  <Money amount={o.price} currency={o.currency} />
                </PricePill>
                {convert(o.price, o.currency) && <span className="text-xs text-fg-muted tabular-nums">Charged: {formatPrice(o.price, o.currency)}</span>}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-fg-muted">{o.currency} · Ready Made account</span>
              <Button size="sm" onClick={() => setSelected(o)}>
                Purchase
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ReadyMadePurchaseDialog offer={selected} viewer={viewer} onClose={() => setSelected(null)} />
    </>
  );
}

/**
 * Confirmation step. The server re-checks the offer, the price and the
 * balance and charges atomically; on success the customer is taken to the
 * order page with the WhatsApp delivery instructions.
 */
function ReadyMadePurchaseDialog({
  offer,
  viewer,
  onClose,
}: {
  offer: ReadyMadeOfferView | null;
  viewer: Viewer;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReadyMadePurchaseResult | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // One key per purchase attempt: double clicks, resubmits and retries after a
  // lost response reuse it, so they can't create a second paid order. A new key
  // is drawn only after the server gave a definite "no".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = useMemo(() => (offer ? newKey() : ""), [offer, attempt]);

  const agreedPrice = price ?? offer?.price ?? 0;
  const currency = offer?.currency ?? "USD";
  const balance = viewer.signedIn ? viewer.balance : 0;
  const insufficient = viewer.signedIn && offer !== null && balance < agreedPrice;
  const busy = pending || leaving;

  function close() {
    if (busy) return;
    setResult(null);
    setPrice(null);
    onClose();
  }

  function confirm() {
    if (!offer) return;
    setResult(null);
    startTransition(async () => {
      let r: ReadyMadePurchaseResult;
      try {
        r = await purchaseReadyMadeAction({ offerId: offer.id, price: agreedPrice, idempotencyKey: key });
      } catch {
        // Unknown whether the server got it: keep the key so a retry returns the same order.
        setResult({ ok: false, code: "ERROR", message: "We couldn't confirm the purchase. Check your connection and press Confirm purchase again — you won't be charged twice." });
        return;
      }
      if (r.ok) {
        setLeaving(true);
        router.push(`/accounts/orders/${r.orderId}?purchased=1`);
        // Re-render server components too, so the header balance shows the charge.
        router.refresh();
        return;
      }
      setResult(r);
      if (r.code !== "ERROR") setAttempt((n) => n + 1);
    });
  }

  const changed = result && !result.ok && result.code === "PRICE_CHANGED" ? result.price : undefined;

  return (
    <Modal
      open={offer !== null}
      onClose={close}
      title="Confirm Ready Made purchase"
      footer={
        viewer.signedIn ? (
          <>
            <Button variant="muted" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} loading={busy} disabled={busy || insufficient || changed !== undefined || (result !== null && !result.ok && result.code === "UNAVAILABLE")}>
              {`Confirm purchase · ${formatPrice(agreedPrice, currency)}`}
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/login?next=%2Faccounts" variant="outline">
              Log in
            </ButtonLink>
            <ButtonLink href="/register">Create account</ButtonLink>
          </>
        )
      }
    >
      {offer && (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
            <dt className="text-fg-muted">Service</dt>
            <dd className="flex items-center gap-2 font-medium">
              <ServiceAvatar name={offer.service.name} color={offer.service.color} logo={offer.service.logo} size={22} />
              {offer.service.name}
            </dd>
            <dt className="text-fg-muted">Country</dt>
            <dd className="flex items-center gap-2 font-medium">
              {offer.country ? (
                <>
                  <CountryFlag iso2={offer.country.iso2} />
                  {offer.country.name}
                </>
              ) : (
                "All countries"
              )}
            </dd>
            <dt className="text-fg-muted">Purchase type</dt>
            <dd className="font-medium">Ready Made account</dd>
            <ChargeRows amount={agreedPrice} currency={currency} />
            {viewer.signedIn && (
              <>
                <dt className="text-fg-muted">Your balance</dt>
                <dd className={insufficient ? "font-semibold text-danger tabular-nums" : "font-medium tabular-nums"}>
                  <Money amount={viewer.balance} currency={viewer.currency} variant="both" />
                </dd>
                {!insufficient && (
                  <>
                    <dt className="text-fg-muted">After purchase</dt>
                    <dd className="font-medium tabular-nums">
                      <Money amount={viewer.balance - agreedPrice} currency={viewer.currency} variant="both" />
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>

          {!viewer.signedIn ? (
            <Alert>Log in or create an account to buy a Ready Made account.</Alert>
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
              This costs {formatPrice(agreedPrice, currency)}; you need {formatPrice(agreedPrice - balance, currency)} more. Top up your balance to buy it.
            </Alert>
          ) : changed !== undefined ? (
            <Alert
              tone="warning"
              title="The price has changed"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPrice(changed);
                    setResult(null);
                  }}
                >
                  {`Use ${formatPrice(changed, currency)}`}
                </Button>
              }
            >
              Confirm the new price to continue. You have not been charged.
            </Alert>
          ) : result && !result.ok ? (
            <Alert tone={result.code === "INSUFFICIENT_FUNDS" || result.code === "UNAVAILABLE" ? "warning" : "error"}>{result.message}</Alert>
          ) : (
            <p className="text-[13px] text-fg-muted">
              The price is charged from your balance now. This is a manual delivery: after the purchase, contact us on WhatsApp with your order
              reference to receive your number/account. No code is sent to this page automatically.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

