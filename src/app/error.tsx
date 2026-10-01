"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { ErrorState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer size="form" className="py-10">
      <Card>
        <ErrorState
          title={t("err.pageFailed")}
          description={error.digest ? t("err.withCode", { code: error.digest }) : t("err.tryMoment")}
          action={
            <div className="flex gap-2">
              <Button onClick={reset}>
                <Icon name="refresh" size={18} /> {t("common.retry")}
              </Button>
              <ButtonLink href="/" variant="outline">
                {t("err.goHome")}
              </ButtonLink>
            </div>
          }
        />
      </Card>
    </PageContainer>
  );
}
