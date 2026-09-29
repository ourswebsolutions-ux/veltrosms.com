"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type TabItem<T extends string> = { value: T; label: string };

const shell = "inline-flex rounded-xl border border-line bg-surface-muted p-1";
const tab =
  "rounded-lg px-4 py-2 text-[15px] font-medium transition-colors whitespace-nowrap sm:px-5 sm:text-base";
const active = "bg-primary text-white shadow-sm";
const inactive = "text-fg-muted hover:text-fg";

/** Segmented control, e.g. "Search by service / Search by country". */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    const next = (index + delta + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn(shell, className)}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(tab, "flex-1", selected ? active : inactive)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Same look, but each tab is a route. */
export function LinkTabs({
  items,
  activeHref,
  className,
}: {
  items: { href: string; label: string }[];
  activeHref: string;
  className?: string;
}) {
  return (
    <nav className={cn(shell, "max-w-full overflow-x-auto", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === activeHref ? "page" : undefined}
          className={cn(tab, item.href === activeHref ? active : inactive)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Text tabs with an underline on the active item (section switchers, filters). */
export function UnderlineTabs({
  items,
  activeHref,
  className,
  label,
}: {
  items: { href: string; label: string; count?: number }[];
  activeHref: string;
  className?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mb-px flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 pt-1 pb-2.5 text-[15px] font-medium whitespace-nowrap transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active ? "bg-primary text-white" : "bg-surface-muted text-fg-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
