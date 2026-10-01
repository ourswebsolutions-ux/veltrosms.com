"use client";

import type { ReactNode } from "react";
import { useDisplayCurrency } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { Dropdown, dropdownItemClass } from "@/components/ui/Dropdown";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { DISPLAY_CURRENCIES } from "@/lib/display-currency";
import { SOUND_KEY, usePref, useTheme } from "@/lib/preferences";

/** Square light-grey icon button used in the header's right cluster. */
export const headerIconButton =
  "flex size-10 items-center justify-center rounded-lg bg-[rgba(34,37,45,0.04)] text-primary transition-colors hover:bg-primary-tint active:bg-primary-selected dark:bg-surface-muted";

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
  return (
    <HeaderIconButton
      label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
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
  return (
    <HeaderIconButton
      label={on ? "Mute SMS sound" : "Unmute SMS sound"}
      pressed={on}
      onClick={() => setPref(on ? "off" : "on")}
      className={className}
    >
      <Icon name={on ? "volume" : "volumeOff"} />
    </HeaderIconButton>
  );
}

export function LanguageMenu() {
  return (
    <Dropdown
      label="Language: English"
      align="right"
      trigger={({ open }) => (
        <span className={cn(headerIconButton, "w-auto gap-1 px-2.5 text-[13px] font-bold text-fg")}>
          EN
          <Icon
            name="caretDown"
            size={14}
            className={cn("text-primary transition-transform", open && "rotate-180")}
          />
        </span>
      )}
    >
      <button type="button" data-close aria-current="true" className={cn(dropdownItemClass(true), "justify-between")}>
        English <Icon name="check" size={16} />
      </button>
      <p className="px-3 pt-2 pb-1 text-xs text-fg-muted">More languages coming soon.</p>
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
  // A chosen currency whose rate is unavailable falls back to the original prices.
  const shown = selected === base || rate ? selected : base;
  return (
    <Dropdown
      label={`Currency: ${shown}`}
      align="right"
      panelClassName="w-64"
      trigger={({ open }) => (
        <span className={cn(headerIconButton, "w-auto gap-1 px-2.5 text-[13px] font-bold text-fg")}>
          <span className="hidden font-medium text-fg-muted sm:inline">Currency:</span>
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
              <b className="font-semibold">{c.code}</b> — {c.name}
              {!available && <span className="block text-xs text-fg-muted">Rate unavailable right now</span>}
            </span>
            {active && <Icon name="check" size={16} />}
          </button>
        );
      })}
      <p className="border-t border-line px-3 pt-2 pb-1 text-xs text-fg-muted">
        Converted prices are approximate. You are always charged in {base}.
      </p>
    </Dropdown>
  );
}

export function NotificationsMenu() {
  return (
    <Dropdown
      label="Notifications"
      align="right"
      panelClassName="w-80 max-w-[calc(100vw-1.5rem)]"
      trigger={() => (
        <span className={headerIconButton}>
          <Icon name="bell" />
        </span>
      )}
    >
      <p className="border-b border-line px-3 pt-1.5 pb-2.5 text-sm font-semibold">Notifications</p>
      <EmptyState compact icon="bell" title="No notifications yet" description="Order updates and news will appear here." />
    </Dropdown>
  );
}
