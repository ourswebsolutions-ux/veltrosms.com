import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { getT } from "@/i18n/server";

export default async function OrderNotFound() {
  const t = await getT();
  return (
    <Card>
      <EmptyState
        icon="search"
        title={t("err.orderNotFound")}
        description={t("err.orderNotFoundBody")}
        action={<ButtonLink href="/profile/history?tab=orders">{t("err.viewOrders")}</ButtonLink>}
      />
    </Card>
  );
}
