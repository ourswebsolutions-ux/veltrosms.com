import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { Skeleton } from "@/components/ui/Spinner";

export default function PriceLoading() {
  return (
    <PageContainer size="form" className="max-w-[900px]">
      <Card className="space-y-4 sm:!p-8" aria-busy="true" aria-label="Loading prices">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-80 max-w-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </Card>
    </PageContainer>
  );
}
