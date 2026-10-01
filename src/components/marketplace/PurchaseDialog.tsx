"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { ChargeRows, Money } from "@/components/currency/DisplayCurrency";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { NumberCard } from "@/components/orders/NumberCard";
import { Modal } from "@/components/ui/Modal";
import { formatCount, formatPrice } from "@/lib/format";
import { requestNumberAction } from "@/server/actions/orders";
import type { OrderActionResult } from "@/server/services/order.service";
import type { Viewer } from "@/types/account";
import type { OfferGroup, PriceTier } from "@/types/catalog";
import { useT } from "@/i18n/client";

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
  const t = useT();
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
        setResult({ ok: false, code: "PROVIDER_ERROR", message: t("purchase.lostResponse") });
      }
    });
  }

  const priceChanged = result && !result.ok && result.code === "PRICE_CHANGED" ? result.prices ?? [] : null;
  const bought = result?.ok ? result.order : null;

  return (
    <Modal
      open={intent !== null}
      onClose={close}
      title={bought ? t("purchase.ready") : t("purchase.title")}
      footer={
        bought ? (
          <>
            <ButtonLink href="/profile" variant="muted">
              {t("purchase.allMyNumbers")}
            </ButtonLink>
            <Button onClick={close}>{t("purchase.done")}</Button>
          </>
        ) : viewer.signedIn ? (
          <>
            <Button variant="muted" onClick={close} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={confirm} loading={pending} disabled={pending || insufficient}>
              {t("purchase.buyFor", { price: formatPrice(agreedPrice, currency) })}
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="outline">
              {t("nav.login")}
            </ButtonLink>
            <ButtonLink href="/register">{t("auth.createAccountButton")}</ButtonLink>
          </>
        )
      }
    >
      {intent && bought ? (
        <div className="space-y-3">
          <Alert tone="success">{t("purchase.readyHint", { service: bought.service.name })}</Alert>
          <NumberCard order={bought} />
        </div>
      ) : intent ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
            <dt className="text-fg-muted">{t("common.service")}</dt>
            <dd className="flex items-center gap-2 font-medium">
              <ServiceAvatar name={intent.group.service.name} color={intent.group.service.color} logo={intent.group.service.logo} size={22} />
              {intent.group.service.name}
            </dd>
            <dt className="text-fg-muted">{t("common.country")}</dt>
            <dd className="flex items-center gap-2 font-medium">
              <CountryFlag iso2={intent.group.country.iso2} />
              {intent.group.country.name}
            </dd>
            <ChargeRows amount={agreedPrice} currency={currency} priceClassName="font-semibold text-primary" />
            <dt className="text-fg-muted">{t("purchase.available")}</dt>
            <dd>{formatCount(intent.tier.available)}</dd>
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
                      <Money amount={after} currency={viewer.currency} variant="both" />
                    </dd>
                  </>
                )}
              </>
            )}
          </dl>

          {!viewer.signedIn ? (
            <Alert>{t("purchase.guest")}</Alert>
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
              {t("purchase.noFundsBody", {
                price: formatPrice(agreedPrice, currency),
                missing: formatPrice(agreedPrice - (viewer.signedIn ? viewer.balance : 0), currency),
              })}
            </Alert>
          ) : priceChanged ? (
            <Alert
              tone="warning"
              title={t("purchase.priceChanged")}
              action={
                priceChanged.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => { setPrice(priceChanged[0]); setResult(null); }}>
                    {t("purchase.usePrice", { price: formatPrice(priceChanged[0], currency) })}
                  </Button>
                )
              }
            >
              {priceChanged.length ? t("purchase.confirmNewPrice") : t("srv.orders.offerGone")}
            </Alert>
          ) : result && !result.ok ? (
            <Alert tone={result.code === "INSUFFICIENT_FUNDS" || result.code === "NO_NUMBERS" ? "warning" : "error"}>
              {t.server(result.message)}
            </Alert>
          ) : (
            <p className="text-[13px] text-fg-muted">
              {t("purchase.chargedNow")}
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
