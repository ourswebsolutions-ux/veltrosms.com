"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Money } from "@/components/currency/DisplayCurrency";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { CopyButton } from "@/components/ui/CopyButton";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { formatPhone, internationalPhone, ltr } from "@/lib/format";
import { SOUND_KEY, usePref } from "@/lib/preferences";
import { cancelOrderAction, finishOrderAction, requestAnotherSmsAction } from "@/server/actions/orders";
import type { OrderActionResult } from "@/server/services/order.service";
import { ACTIVE_ORDER_STATUSES, type OrderListItem } from "@/types/account";
import { publishOrder, useLiveOrder } from "./order-store";
import { ORDER_STATUS } from "@/i18n/labels";
import { OrderStatus } from "./OrderStatus";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/config";
import { DateTime } from "@/components/ui/DateTime";

function useNow(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const time = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

/** Short notification tone (no audio file needed). */
function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio unavailable */
  }
}

/**
 * One activation, kept up to date while it is live (see order-store: one
 * polling loop per order however many cards show it). Used on the price page,
 * in the marketplace sidebar, the purchase dialog and the profile.
 */
export function NumberCard({ order: initial, className }: { order: OrderListItem; className?: string }) {
  const router = useRouter();
  const order = useLiveOrder(initial);
  const t = useT();
  const { locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"cancel" | "finish" | "another" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundPref] = usePref(SOUND_KEY);
  const lastCode = useRef(order.code);

  const live = ACTIVE_ORDER_STATUSES.includes(order.status);
  const now = useNow(live);

  // Chime when a new code arrives.
  useEffect(() => {
    if (order.code && order.code !== lastCode.current && soundPref !== "off") beep();
    lastCode.current = order.code;
  }, [order.code, soundPref]);

  // When the order closes (cancel, expiry, refund) the balance changed on the
  // server: re-render server components so no stale balance stays on screen.
  const wasLive = useRef(live);
  useEffect(() => {
    if (wasLive.current && !live) router.refresh();
    wasLive.current = live;
  }, [live, router]);

  function run(kind: "cancel" | "finish" | "another") {
    setBusy(kind);
    setError(null);
    startTransition(async () => {
      let r: OrderActionResult;
      try {
        r =
          kind === "cancel"
            ? await cancelOrderAction(order.id)
            : kind === "finish"
              ? await finishOrderAction(order.id)
              : await requestAnotherSmsAction(order.id);
      } catch {
        r = { ok: false, code: "PROVIDER_ERROR", message: t("order.unreachable") };
      }
      if (r.ok) publishOrder(r.order);
      else setError(t.server(r.message));
      setBusy(null);
      setConfirmCancel(false);
    });
  }

  const remaining = order.expiresAt && now !== null ? Math.max(0, Math.floor((Date.parse(order.expiresAt) - now) / 1000)) : null;
  const cancelIn = order.cancelableAt && now !== null ? Math.ceil((Date.parse(order.cancelableAt) - now) / 1000) : 0;
  const waiting = order.status === "active" || order.status === "pending";
  const cancelBlockedReason =
    order.status === "sms_received" || (live && order.smsCount > 0)
      ? t("order.cantCancelCode")
      : order.status === "pending"
        ? t("order.stillIssuing")
        : null;

  return (
    <article
      aria-label={t("order.cardLabel", { service: order.service.name, country: order.country.name })}
      className={cn("@container rounded-xl border bg-surface p-4", waiting ? "border-primary-tint-border" : "border-line", className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ServiceAvatar name={order.service.name} color={order.service.color} logo={order.service.logo} size={32} />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate font-semibold rtl:text-right">
            {order.service.name}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
            <CountryFlag iso2={order.country.iso2} size={16} />
            {order.country.name} · <Money amount={order.price} currency={order.currency} variant="both" />
          </p>
        </div>
        <OrderStatus status={order.status} />
      </header>

      <div className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-2">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted py-1.5 pe-1.5 ps-3">
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">{t("order.phone")}</p>
            <p className="truncate font-mono text-[17px] font-semibold tabular-nums">{order.phoneNumber ? formatPhone(order.phoneNumber) : "—"}</p>
          </div>
          {order.phoneNumber && <CopyButton value={internationalPhone(order.phoneNumber)} label={t("order.copyNumber")} />}
        </div>
        <div
          className={cn("flex items-center justify-between gap-2 rounded-lg py-1.5 pe-1.5 ps-3", order.code ? "bg-success-tint" : "bg-surface-muted")}
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">
              {t("common.code")}
              {order.smsCount > 1 ? ` (${t("order.smsCount", { count: order.smsCount })})` : ""}
            </p>
            {order.code ? (
              <p dir="ltr" className="text-start font-mono text-[17px] font-bold tracking-wider text-success">
                {order.code}
              </p>
            ) : live ? (
              <p className="flex items-center gap-1.5 text-[15px] text-fg-muted">
                <Icon name="refresh" size={14} className="animate-spin [animation-duration:2.5s]" />
                {t("order.waitingSms")}
              </p>
            ) : (
              <p className="text-[15px] text-fg-muted">{t("order.noCode")}</p>
            )}
          </div>
          {order.code && <CopyButton value={order.code} label={t("order.copyCode")} />}
        </div>
      </div>

      {order.messages.length > 0 && (
        <ol className="mt-2 space-y-1.5" aria-label={t("order.messages")}>
          {order.messages.map((m) => (
            <li key={m.id} className="rounded-lg bg-surface-muted px-3 py-2 text-[13px]">
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                {m.sender && <span className="font-medium text-fg-muted">{m.sender}</span>}
                <time dateTime={m.receivedAt} suppressHydrationWarning>
                  {ltr(time(m.receivedAt, intlLocale(locale)))}
                </time>
                {m.code && order.messages.length > 1 && <span className="font-mono font-semibold text-success">{m.code}</span>}
              </p>
              {m.text !== m.code && <p className="mt-0.5 break-words text-fg-muted">{m.text}</p>}
            </li>
          ))}
        </ol>
      )}

      {!live && <p className="mt-2 text-[13px] text-fg-muted">{t(ORDER_STATUS[order.status].description)}</p>}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-subtle">
        <span className="inline-flex items-center gap-1">
          {t("order.order")} <bdi className="font-mono">{order.id.slice(0, 8)}</bdi>
          <CopyButton value={order.id} label={t("order.copyId")} className="size-5" />
        </span>
        <DateTime iso={order.createdAt} short />
      </p>

      {live && (
        <footer className="mt-3 flex flex-wrap items-center gap-2">
          {remaining !== null && (
            <span
              className={cn("me-auto inline-flex items-center gap-1.5 text-sm tabular-nums", remaining < 120 ? "text-danger" : "text-fg-muted")}
              aria-label={t("order.timeLeft", { time: mmss(remaining) })}
            >
              <Icon name="history" size={16} />
              <bdi>{remaining > 0 ? mmss(remaining) : t("order.expiring")}</bdi>
            </span>
          )}
          {order.canCancel && (
            <Button
              size="sm"
              variant="outline"
              loading={pending && busy === "cancel"}
              disabled={pending || cancelIn > 0}
              title={cancelIn > 0 ? t("order.cancelOpensIn", { time: mmss(cancelIn) }) : undefined}
              onClick={() => setConfirmCancel(true)}
            >
              {cancelIn > 0 ? t("order.cancelIn", { time: mmss(cancelIn) }) : t("order.cancelRefund")}
            </Button>
          )}
          {order.canRequestAnother && (
            <Button size="sm" variant="outline" loading={pending && busy === "another"} disabled={pending} onClick={() => run("another")}>
              {t("order.anotherCode")}
            </Button>
          )}
          {order.canFinish && (
            <Button size="sm" loading={pending && busy === "finish"} disabled={pending} onClick={() => run("finish")}>
              {t("order.finish")}
            </Button>
          )}
          {!order.canCancel && cancelBlockedReason && <p className="w-full text-xs text-fg-muted">{cancelBlockedReason}</p>}
        </footer>
      )}

      {error && (
        <Alert tone="warning" className="mt-3">
          {error}
        </Alert>
      )}

      <Modal
        open={confirmCancel}
        onClose={() => !pending && setConfirmCancel(false)}
        title={t("order.cancelTitle")}
        footer={
          <>
            <Button variant="muted" onClick={() => setConfirmCancel(false)} disabled={pending}>
              {t("order.keepWaiting")}
            </Button>
            <Button onClick={() => run("cancel")} loading={pending && busy === "cancel"} disabled={pending}>
              {t("order.cancelNumber")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[15px]">
          <p>
            {t("order.cancelBody", {
              number: order.phoneNumber ? formatPhone(order.phoneNumber) : "",
              service: order.service.name,
              country: order.country.name,
            })}
          </p>
          <Alert tone="info">
            {t("order.cancelRefundNote1")}{" "}
            <b>
              <Money amount={order.price} currency={order.currency} variant="both" />
            </b>{" "}
            {t("order.cancelRefundNote2")}
          </Alert>
        </div>
      </Modal>
    </article>
  );
}
