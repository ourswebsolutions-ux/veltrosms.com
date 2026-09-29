"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Click-to-open popover anchored to a trigger (menus, notifications, language).
 *  - Closes on outside click, Esc (focus returns to the trigger), or when an
 *    element with [data-close] inside it is activated.
 *  - ↓ on the trigger opens it and focuses the first item; ↑/↓ move between items.
 */
export function Dropdown({
  trigger,
  children,
  align = "left",
  className,
  panelClassName,
  label,
  triggerClassName,
}: {
  trigger: (props: { open: boolean }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
  triggerClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusFirstOnOpen = useRef(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    if (focusFirstOnOpen.current) {
      focusFirstOnOpen.current = false;
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onTriggerKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusFirstOnOpen.current = true;
      if (open) panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      else setOpen(true);
    }
  }

  function onPanelKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next].focus();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn("flex items-center rounded-lg", triggerClassName)}
      >
        {trigger({ open })}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          onKeyDown={onPanelKey}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-close]")) setOpen(false);
          }}
          className={cn(
            "animate-pop absolute top-full z-50 mt-2 min-w-48 rounded-xl border border-line bg-surface p-1.5 shadow-pop",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Standard row inside a Dropdown panel. */
export function dropdownItemClass(active?: boolean) {
  return cn(
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
    active ? "font-semibold text-primary" : "text-fg",
  );
}
