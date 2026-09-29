import { Badge, StatusDot } from "@/components/ui/Badge";
import type { OrderStatus as Status } from "@/types/account";

type Tone = "soft" | "success" | "neutral" | "danger" | "warning";

export const ORDER_STATUS: Record<Status, { label: string; tone: Tone; description: string }> = {
  pending: { label: "Getting number", tone: "soft", description: "Requesting a number from the provider." },
  active: { label: "Waiting for SMS", tone: "soft", description: "Enter the number on the service and wait for the code." },
  sms_received: { label: "SMS received", tone: "success", description: "A code arrived. Finish, or request another code." },
  completed: { label: "Completed", tone: "success", description: "The activation finished successfully." },
  cancelled: { label: "Cancelled", tone: "neutral", description: "Cancelled before a code arrived. Funds returned." },
  refunded: { label: "Refunded", tone: "warning", description: "The charge was returned to your balance." },
  failed: { label: "Failed", tone: "danger", description: "No number could be issued. You were not charged." },
  expired: { label: "Expired", tone: "danger", description: "No SMS arrived in time. Funds returned." },
};

/** Status pill for an order/activation. */
export function OrderStatus({ status, variant = "badge" }: { status: Status; variant?: "badge" | "dot" }) {
  const s = ORDER_STATUS[status];
  if (variant === "dot") {
    const dot = s.tone === "success" ? "success" : s.tone === "danger" ? "danger" : s.tone === "soft" || s.tone === "warning" ? "warning" : "neutral";
    return <StatusDot tone={dot}>{s.label}</StatusDot>;
  }
  return (
    <Badge tone={s.tone} className={status === "pending" || status === "active" ? "gap-1.5" : undefined}>
      {(status === "pending" || status === "active") && (
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      )}
      {s.label}
    </Badge>
  );
}
