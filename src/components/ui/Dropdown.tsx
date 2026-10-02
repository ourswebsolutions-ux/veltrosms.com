"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";
/** Gap kept between the panel and the viewport edges, in px. */
const EDGE = 8;
/** Below this height a panel prefers whichever side (above/below) has more room. */
const MIN_PANEL_HEIGHT = 160;

/**
 * Click-to-open popover anchored to a trigger (menus, notifications, language).
 *  - Closes on outside click, Esc (focus returns to the trigger), or when an
 *    element with [data-close] inside it is activated.
 *  - ↓ on the trigger opens it and focuses the first item; ↑/↓ move between items.
 *  - Stays on screen: opens upwards when there is more room above, never
 *    taller than the space available (long lists scroll inside the panel),
 *    and shifts sideways to keep an 8px margin from the viewport edges.
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
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight?: number; shift: number }>({ up: false, shift: 0 });

  // Fit the panel into the viewport (before paint, and again on resize).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const natural = panel.scrollHeight;
      const below = vh - trigger.bottom - EDGE * 2;
      const above = trigger.top - EDGE * 2;
      const up = natural > below && above > below && below < Math.max(MIN_PANEL_HEIGHT, natural);
      const room = Math.max(up ? above : below, MIN_PANEL_HEIGHT);
      // Horizontal: measure where the aligned panel lands without any previous shift.
      panel.style.translate = "";
      const rect = panel.getBoundingClientRect();
      let shift = 0;
      if (rect.right > vw - EDGE) shift = vw - EDGE - rect.right;
      if (rect.left + shift < EDGE) shift = EDGE - rect.left;
      setPlacement({ up, maxHeight: natural > room ? room : undefined, shift });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

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
          style={
            {
              maxHeight: placement.maxHeight,
              translate: placement.shift ? `${placement.shift}px 0` : undefined,
            } satisfies CSSProperties
          }
          className={cn(
            "animate-pop absolute z-50 max-w-[calc(100vw-1rem)] min-w-48 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1.5 shadow-pop",
            placement.up ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "end-0" : "start-0",
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
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm transition-colors outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
    active ? "font-semibold text-primary" : "text-fg",
  );
}
