import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";

export default function AdminLoading() {
  return (
    <Card className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-1/4" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </Card>
  );
}
