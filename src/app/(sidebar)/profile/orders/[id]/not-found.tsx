import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

export default function OrderNotFound() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title="Order not found"
        description="This order doesn't exist or doesn't belong to your account."
        action={<ButtonLink href="/profile/history?tab=orders">View your orders</ButtonLink>}
      />
    </Card>
  );
}
