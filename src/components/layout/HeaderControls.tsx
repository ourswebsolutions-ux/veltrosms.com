"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { useDisplayCurrency } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { Dropdown, dropdownItemClass } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/States";
import { useLocale, useT } from "@/i18n/client";
import { dirOf, LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { DISPLAY_CURRENCIES } from "@/lib/display-currency";
import { SOUND_KEY, usePref, useTheme } from "@/lib/preferences";
import { setLocaleAction } from "@/server/actions/locale";

/** Square light-grey icon button used in the header's right cluster. */
export const headerIconButton =
  "flex size-9 sm:size-10 items-center justify-center rounded-lg bg-[rgba(34,37,45,0.04)] text-primary transition-colors hover:bg-primary-tint active:bg-primary-selected dark:bg-surface-muted";

export function HeaderIconButton({
  label,
  onClick,
  children,
  className,
  pressed,
  expanded,
  controls,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      onClick={onClick}
      className={cn(headerIconButton, className)}
    >
      {children}
    </button>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const t = useT();
  return (
    <HeaderIconButton
      label={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={className}
    >
      <Icon name={theme === "dark" ? "moon" : "sun"} />
    </HeaderIconButton>
  );
}

/** Preference for playing a sound when an SMS arrives. */
export function SoundToggle({ className }: { className?: string }) {
  const [pref, setPref] = usePref(SOUND_KEY);
  const on = pref !== "off";
  const t = useT();
  return (
    <HeaderIconButton
      label={on ? t("header.soundMute") : t("header.soundUnmute")}
      pressed={on}
      onClick={() => setPref(on ? "off" : "on")}
      className={className}
    >
      <Icon name={on ? "volume" : "volumeOff"} />
    </HeaderIconButton>
  );
}

/**
 * Interface language (English, Urdu, Hindi, Bengali). Saved in a cookie by a
 * server action; the page then re-renders on the server in that language
 * (right-to-left for Urdu).
 */
export function LanguageMenu() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      const r = await setLocaleAction(next);
      if (r.ok) router.refresh();
    });
  }

  return (
    <Dropdown
      label={`${t("header.language")}: ${LOCALE_NAMES[locale].native}`}
      align="right"
      panelClassName="w-56"
      trigger={({ open }) => (
        <span className={cn(headerIconButton, "w-auto gap-1 px-2 sm:w-auto text-[13px] font-bold whitespace-nowrap text-fg sm:px-2.5", pending && "opacity-60")}>
          <Icon name="globe" size={18} className="text-primary sm:hidden" />
          <span className="hidden font-medium text-fg-muted sm:inline">{t("header.language")}:</span>
          <span className="hidden sm:inline">{LOCALE_NAMES[locale].native}</span>
          <Icon name="caretDown" size={14} className={cn("text-primary transition-transform", open && "rotate-180")} />
        </span>
      )}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          data-close
          lang={l}
          dir={dirOf(l)}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => choose(l)}
          className={cn(dropdownItemClass(l === locale), "justify-between")}
        >
          <span>
            {LOCALE_NAMES[l].native}
            {l !== "en" && <span className="text-fg-muted"> — {LOCALE_NAMES[l].english}</span>}
          </span>
          {l === locale && <Icon name="check" size={16} />}
        </button>
      ))}
    </Dropdown>
  );
}

/**
 * Website-wide display currency (USD, PKR, INR, BDT). Display only: every
 * purchase is still charged in the platform currency. Currencies without a
 * current exchange rate are listed as unavailable.
 */
export function CurrencyMenu() {
  const { selected, setSelected, base, rates, rate } = useDisplayCurrency();
  const t = useT();
  // A chosen currency whose rate is unavailable falls back to the original prices.
  const shown = selected === base || rate ? selected : base;
  return (
    <Dropdown
      label={`${t("currency.label")}: ${shown}`}
      align="right"
      panelClassName="w-64"
      trigger={({ open }) => (
        <span className={cn(headerIconButton, "w-auto gap-1 px-2 sm:w-auto text-[13px] font-bold whitespace-nowrap text-fg sm:px-2.5")}>
          <span className="hidden font-medium text-fg-muted sm:inline">{t("currency.label")}:</span>
          {shown}
          <Icon name="caretDown" size={14} className={cn("text-primary transition-transform", open && "rotate-180")} />
        </span>
      )}
    >
      {DISPLAY_CURRENCIES.map((c) => {
        const available = c.code === base || Boolean(rates[c.code]);
        const active = c.code === shown;
        return (
          <button
            key={c.code}
            type="button"
            data-close
            disabled={!available}
            aria-current={active ? "true" : undefined}
            onClick={() => setSelected(c.code)}
            className={cn(dropdownItemClass(active), "justify-between disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <span>
              <b className="font-semibold">{c.code}</b> — {t(`currency.${c.code}`)}
              {!available && <span className="block text-xs text-fg-muted">{t("currency.unavailable")}</span>}
            </span>
            {active && <Icon name="check" size={16} />}
          </button>
        );
      })}
      <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-fg-muted">
        {t("currency.note", { base })}
      </p>
    </Dropdown>
  );
}

export function NotificationsMenu({ className, align = "right" }: { className?: string; align?: "left" | "right" }) {
  const t = useT();
  return (
    <Dropdown
      label={t("header.notifications")}
      align={align}
      className={className}
      panelClassName="w-80 max-w-[calc(100vw-1.5rem)]"
      trigger={() => (
        <span className={headerIconButton}>
          <Icon name="bell" />
        </span>
      )}
    >
      <p className="border-b border-line px-3 pt-1.5 pb-2.5 text-sm font-semibold">{t("header.notifications")}</p>
      <EmptyState compact icon="bell" title={t("header.noNotifications")} description={t("header.noNotificationsHint")} />
    </Dropdown>
  );
}
