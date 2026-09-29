import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "primary" | "soft" | "neutral" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  primary: "bg-primary text-white",
  soft: "bg-primary-tint text-primary",
  neutral: "bg-surface-muted text-fg-muted",
  success: "bg-success-tint text-success",
  warning: "bg-warning/15 text-[#a37c00] dark:text-warning",
  danger: "bg-danger-tint text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Coloured dot + label, e.g. availability High / Medium / Low. */
export function StatusDot({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}) {
  const color = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    neutral: "bg-fg-subtle",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", color)} />
      {children}
    </span>
  );
}

/** Solid orange price pill used on every offer row. */
export function PricePill({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-start rounded-md bg-primary font-semibold text-white tabular-nums",
        size === "md" ? "h-8 min-w-[80px] px-3 text-[15px]" : "h-8 min-w-[72px] px-3 text-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
