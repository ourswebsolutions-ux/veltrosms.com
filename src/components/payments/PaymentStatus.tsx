import { Badge } from "@/components/ui/Badge";
import type { PaymentStatus as Status } from "@/types/account";

type Tone = "soft" | "success" | "neutral" | "danger" | "warning";

export const PAYMENT_STATUS: Record<Status, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting payment", tone: "soft" },
  processing: { label: "Processing", tone: "soft" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  refunded: { label: "Refunded", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
};

/** Manual (admin-verified) requests read differently. */
const MANUAL_LABEL: Partial<Record<Status, string>> = { pending: "Awaiting verification", paid: "Approved" };

export function paymentStatusLabel(status: Status, manual = false): string {
  return (manual && MANUAL_LABEL[status]) || PAYMENT_STATUS[status].label;
}

export function PaymentStatusBadge({ status, manual = false }: { status: Status; manual?: boolean }) {
  return <Badge tone={PAYMENT_STATUS[status].tone}>{paymentStatusLabel(status, manual)}</Badge>;
}
