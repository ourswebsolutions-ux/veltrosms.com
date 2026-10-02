"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc and
 * top-layer rendering come for free). Never taller than the screen: the title
 * bar and the actions stay in view and only the body scrolls.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface p-0 text-fg shadow-pop backdrop:bg-black/40 open:flex",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-3 ps-5 pe-3 sm:py-4">
        <h2 className="min-w-0 text-lg font-semibold wrap-anywhere">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-2 text-fg-muted hover:bg-surface-muted hover:text-fg"
          aria-label={t("common.close")}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </dialog>
  );
}
