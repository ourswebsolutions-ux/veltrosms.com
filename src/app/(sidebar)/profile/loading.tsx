import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";
import { getT } from "@/i18n/server";

export default async function ProfileLoading() {
  const t = await getT();
  return (
    <Card className="space-y-4" aria-busy="true" aria-label={t("common.loading")}>
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
