"use client";

import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/client";
import { PAYMENT_STATUS, paymentStatusKey } from "@/i18n/labels";
import type { PaymentStatus as Status } from "@/types/account";

export function PaymentStatusBadge({ status, manual = false }: { status: Status; manual?: boolean }) {
  const t = useT();
  return <Badge tone={PAYMENT_STATUS[status].tone}>{t(paymentStatusKey(status, manual))}</Badge>;
}
