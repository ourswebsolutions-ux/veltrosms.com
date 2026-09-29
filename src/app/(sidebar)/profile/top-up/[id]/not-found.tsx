import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

export default function PaymentNotFound() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title="Payment not found"
        description="This payment doesn't exist or doesn't belong to your account."
        action={<ButtonLink href="/profile/history?tab=payments">View your payments</ButtonLink>}
      />
    </Card>
  );
}
