import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";

export default function ProfileLoading() {
  return (
    <Card className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </Card>
  );
}
