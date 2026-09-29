import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";

export default function AdminNotFound() {
  return (
    <Card>
      <EmptyState icon="search" title="Not found" description="This record doesn't exist." action={<ButtonLink href="/admin">Back to dashboard</ButtonLink>} />
    </Card>
  );
}
