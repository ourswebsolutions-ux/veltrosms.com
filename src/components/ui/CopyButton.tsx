"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { stripBidi } from "@/lib/format";
import { useT } from "@/i18n/client";

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({
  value,
  label,
  className,
  showLabel = false,
}: {
  value: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const t = useT();

  async function copy() {
    try {
      await navigator.clipboard.writeText(stripBidi(value));
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  }

  const text = state === "copied" ? t("common.copied") : state === "failed" ? t("common.copyFailed") : (label ?? t("common.copy"));
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={showLabel ? undefined : text}
      title={text}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-primary transition-colors hover:bg-primary-tint",
        showLabel ? "h-9 px-3 text-sm font-semibold" : "size-8",
        className,
      )}
    >
      <Icon name={state === "copied" ? "check" : "copy"} size={16} />
      {showLabel && <span aria-live="polite">{text}</span>}
      {!showLabel && (
        <span className="sr-only" aria-live="polite">
          {state === "idle" ? "" : text}
        </span>
      )}
    </button>
  );
}
