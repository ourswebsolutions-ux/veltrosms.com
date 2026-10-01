"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

type Toast = { id: number; tone: "success" | "error"; message: string };
type Ctx = (tone: Toast["tone"], message: string) => void;

const ToastContext = createContext<Ctx | null>(null);

/**
 * Toast notifications. Mounted above the page, so a message survives the
 * re-render that follows an action (e.g. a button that disappears once its
 * record changed state). Announced to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const tr = useT();
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback<Ctx>(
    (tone, message) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:end-5 sm:bottom-5">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "animate-pop pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-surface px-4 py-3 text-sm shadow-pop",
              t.tone === "success" ? "border-success/40" : "border-danger/40",
            )}
          >
            <Icon name={t.tone === "success" ? "checkCircle" : "alert"} size={18} className={cn("mt-0.5 shrink-0", t.tone === "success" ? "text-success" : "text-danger")} />
            <p className="min-w-0 flex-1">{tr.server(t.message)}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label={tr("common.dismiss")} className="shrink-0 text-fg-subtle hover:text-fg">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  return useContext(ToastContext) ?? (() => {});
}

/** Shows a toast whenever a form action's state settles into success/error. */
export function useResultToast(state: { status: string; message?: string }) {
  const toast = useToast();
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if ((state.status === "success" || state.status === "error") && state.message) toast(state.status, state.message);
  }, [state, toast]);
}
