import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { getT } from "@/i18n/server";

export default async function PaymentNotFound() {
  const t = await getT();
  return (
    <Card>
      <EmptyState
        icon="search"
        title={t("err.paymentNotFound")}
        description={t("err.paymentNotFoundBody")}
        action={<ButtonLink href="/profile/history?tab=payments">{t("err.viewPayments")}</ButtonLink>}
      />
    </Card>
  );
}
