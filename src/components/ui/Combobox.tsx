"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

export type ComboboxOption = { value: string; label: string; icon?: ReactNode };

/**
 * Searchable single-select with rich options (icons/flags). Keyboard:
 * ↑/↓ to move, Enter to choose, Esc to close.
 */
export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  className,
}: {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const t = useT();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function openList() {
    setQuery("");
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[cursor]) choose(filtered[cursor]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : openList())}
        className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-line bg-surface-muted pe-3 ps-2 text-start text-[15px] text-fg outline-none focus-visible:border-primary"
      >
        {selected?.icon}
        <span className={cn("flex-1 truncate", !selected && "text-fg-subtle")}>
          {selected?.label ?? placeholder ?? t("common.select")}
        </span>
        <Icon name="chevronDown" className={cn("text-primary transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder ?? t("common.search")}
            aria-label={searchPlaceholder ?? t("common.search")}
            aria-controls={listId}
            aria-activedescendant={filtered[cursor] ? `${listId}-${filtered[cursor].value}` : undefined}
            className="mb-1 h-9 w-full rounded-md bg-surface-muted px-3 text-sm outline-none placeholder:text-fg-subtle"
          />
          <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto scroll-thin">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-fg-muted">{t("common.noResults")}</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${o.value}`}
                role="option"
                aria-selected={o.value === value}
                onPointerEnter={() => setCursor(i)}
                onClick={() => choose(o)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm",
                  i === cursor && "bg-surface-muted",
                  o.value === value && "font-semibold text-primary",
                )}
              >
                {o.icon}
                <span className="truncate">{o.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
