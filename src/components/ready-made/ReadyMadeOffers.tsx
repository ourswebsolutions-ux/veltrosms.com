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
import { formatCount, formatPrice } from "@/lib/format";
import { purchaseReadyMadeAction } from "@/server/actions/ready-made";
import type { Viewer } from "@/types/account";
import type { ReadyMadeOfferView, ReadyMadePurchaseResult } from "@/types/ready-made";
import { useT } from "@/i18n/client";

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
  const t = useT();

  if (offers.length === 0) {
    return (
      <EmptyState
        icon="box"
        title={t("rm.emptyTitle")}
        description={t("rm.emptyBody")}
        action={
          <ButtonLink href="/price" variant="outline">
            {t("rm.browseNumbers")}
          </ButtonLink>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {offers.map((o) => (
          <li key={o.id} className="flex flex-col gap-4 rounded-xl border border-line bg-surface-muted/60 p-4">
            <div className="flex items-center gap-3">
              <ServiceAvatar name={o.service.name} color={o.service.color} logo={o.service.logo} size={40} />
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-[17px] font-semibold rtl:text-right">
                  {o.service.name}
                </p>
                <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                  {o.country ? (
                    <>
                      <CountryFlag iso2={o.country.iso2} size={16} />
                      <bdi>{o.country.name}</bdi>
                    </>
                  ) : (
                    <>
                      <Icon name="globe" size={15} />
                      {t("common.allCountries")}
                    </>
                  )}
                </p>
                <Availability count={o.available} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <PricePill>
                  <Money amount={o.price} currency={o.currency} />
                </PricePill>
                {convert(o.price, o.currency) && (
                  <span className="text-xs text-fg-muted tabular-nums">
                    {t("rm.charged", {
                      price: formatPrice(o.price, o.currency),
                    })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-fg-muted">
                <bdi>{o.currency}</bdi> · {t("rm.type")}
              </span>
              <Button size="sm" onClick={() => setSelected(o)} disabled={o.available <= 0}>
                {t("rm.purchase")}
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
function ReadyMadePurchaseDialog({ offer, viewer, onClose }: { offer: ReadyMadeOfferView | null; viewer: Viewer; onClose: () => void }) {
  const router = useRouter();
  const t = useT();
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
        r = await purchaseReadyMadeAction({
          offerId: offer.id,
          price: agreedPrice,
          idempotencyKey: key,
        });
      } catch {
        // Unknown whether the server got it: keep the key so a retry returns the same order.
        setResult({ ok: false, code: "ERROR", message: t("rm.lostResponse") });
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
      // Someone bought the last one: refresh the list so the card shows the new availability.
      if (r.code === "OUT_OF_STOCK") router.refresh();
    });
  }

  const changed = result && !result.ok && result.code === "PRICE_CHANGED" ? result.price : undefined;
  const soldOut = offer !== null && offer.available <= 0;

  return (
    <Modal
      open={offer !== null}
      onClose={close}
      title={t("rm.confirmTitle")}
      footer={
        viewer.signedIn ? (
          <>
            <Button variant="muted" onClick={close} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={confirm}
              loading={busy}
              disabled={
                busy ||
                insufficient ||
                soldOut ||
                changed !== undefined ||
                (result !== null && !result.ok && (result.code === "UNAVAILABLE" || result.code === "OUT_OF_STOCK"))
              }
            >
              {t("rm.confirmFor", {
                price: formatPrice(agreedPrice, currency),
              })}
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/login?next=%2Faccounts" variant="outline">
              {t("nav.login")}
            </ButtonLink>
            <ButtonLink href="/register?next=%2Faccounts">{t("rm.createAccount")}</ButtonLink>
          </>
        )
      }
    >
      {offer && (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[15px]">
            <dt className="text-fg-muted">{t("common.service")}</dt>
            <dd className="flex items-center gap-2 font-medium">
              <ServiceAvatar name={offer.service.name} color={offer.service.color} logo={offer.service.logo} size={22} />
              <bdi>{offer.service.name}</bdi>
            </dd>
            <dt className="text-fg-muted">{t("common.country")}</dt>
            <dd className="flex items-center gap-2 font-medium">
              {offer.country ? (
                <>
                  <CountryFlag iso2={offer.country.iso2} />
                  <bdi>{offer.country.name}</bdi>
                </>
              ) : (
                t("common.allCountries")
              )}
            </dd>
            <dt className="text-fg-muted">{t("rm.purchaseType")}</dt>
            <dd className="font-medium">{t("rm.type")}</dd>
            <dt className="text-fg-muted">{t("rm.availableLabel")}</dt>
            <dd>
              <Availability count={offer.available} />
            </dd>
            <ChargeRows amount={agreedPrice} currency={currency} />
            {viewer.signedIn && (
              <>
                <dt className="text-fg-muted">{t("purchase.yourBalance")}</dt>
                <dd className={insufficient ? "font-semibold text-danger tabular-nums" : "font-medium tabular-nums"}>
                  <Money amount={viewer.balance} currency={viewer.currency} variant="both" />
                </dd>
                {!insufficient && (
                  <>
                    <dt className="text-fg-muted">{t("purchase.after")}</dt>
                    <dd className="font-medium tabular-nums">
                      <Money amount={viewer.balance - agreedPrice} currency={viewer.currency} variant="both" />
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>

          {!viewer.signedIn ? (
            <Alert>{t("rm.guest")}</Alert>
          ) : insufficient ? (
            <Alert
              tone="warning"
              title={t("purchase.noFunds")}
              action={
                <ButtonLink href="/profile/top-up" size="sm" variant="outline">
                  {t("nav.addFunds")}
                </ButtonLink>
              }
            >
              {t("rm.noFundsBody", {
                price: formatPrice(agreedPrice, currency),
                missing: formatPrice(agreedPrice - balance, currency),
              })}
            </Alert>
          ) : changed !== undefined ? (
            <Alert
              tone="warning"
              title={t("purchase.priceChanged")}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPrice(changed);
                    setResult(null);
                  }}
                >
                  {t("purchase.usePrice", {
                    price: formatPrice(changed, currency),
                  })}
                </Button>
              }
            >
              {t("rm.confirmNewPrice")}
            </Alert>
          ) : result && !result.ok ? (
            <Alert tone={result.code === "INSUFFICIENT_FUNDS" || result.code === "UNAVAILABLE" || result.code === "OUT_OF_STOCK" ? "warning" : "error"}>
              {t.server(result.message)}
            </Alert>
          ) : (
            <p className="text-[13px] text-fg-muted">{t("rm.manualHint")}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** "25 accounts available" / "Out of stock" for one offer. */
function Availability({ count }: { count: number }) {
  const t = useT();
  if (count <= 0) return <p className="mt-0.5 text-[13px] font-semibold text-danger">{t("rm.outOfStock")}</p>;
  return (
    <p className="mt-0.5 text-[13px] font-medium text-success tabular-nums">
      {count === 1 ? t("rm.availableOne") : t("rm.availableMany", { count: formatCount(count) })}
    </p>
  );
}
