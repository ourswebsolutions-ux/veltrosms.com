import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, { box: string; icon: IconName; iconColor: string }> = {
  info: { box: "bg-primary-tint border-primary-tint-border", icon: "alert", iconColor: "text-primary" },
  success: { box: "bg-success-tint border-success/30", icon: "checkCircle", iconColor: "text-success" },
  warning: { box: "bg-warning/15 border-warning/40", icon: "alert", iconColor: "text-[#a37c00] dark:text-warning" },
  error: { box: "bg-danger-tint border-danger/30", icon: "alert", iconColor: "text-danger" },
};

/**
 * Inline message box. Errors are announced immediately (role="alert");
 * other tones politely (role="status").
 */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm text-fg", t.box, className)}
    >
      <Icon name={t.icon} size={18} className={cn("mt-px shrink-0", t.iconColor)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-fg-muted" : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
