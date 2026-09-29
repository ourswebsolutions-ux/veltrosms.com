"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({
  value,
  label = "Copy",
  className,
  showLabel = false,
}: {
  value: string;
  label?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  }

  const text = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;
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
