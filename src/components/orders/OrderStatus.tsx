"use client";

import { Badge, StatusDot } from "@/components/ui/Badge";
import { useT } from "@/i18n/client";
import { ORDER_STATUS } from "@/i18n/labels";
import type { OrderStatus as Status } from "@/types/account";

/** Status pill for an order/activation. */
export function OrderStatus({ status, variant = "badge" }: { status: Status; variant?: "badge" | "dot" }) {
  const t = useT();
  const s = ORDER_STATUS[status];
  if (variant === "dot") {
    const dot = s.tone === "success" ? "success" : s.tone === "danger" ? "danger" : s.tone === "soft" || s.tone === "warning" ? "warning" : "neutral";
    return <StatusDot tone={dot}>{t(s.label)}</StatusDot>;
  }
  return (
    <Badge tone={s.tone} className={status === "pending" || status === "active" ? "gap-1.5" : undefined}>
      {(status === "pending" || status === "active") && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      )}
      {t(s.label)}
    </Badge>
  );
}
