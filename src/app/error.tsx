"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { ErrorState } from "@/components/ui/States";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer size="form" className="py-10">
      <Card>
        <ErrorState
          title="This page failed to load"
          description={
            error.digest
              ? `Please try again. If it keeps happening, contact support with code ${error.digest}.`
              : "Please try again in a moment."
          }
          action={
            <div className="flex gap-2">
              <Button onClick={reset}>
                <Icon name="refresh" size={18} /> Try again
              </Button>
              <ButtonLink href="/" variant="outline">
                Go home
              </ButtonLink>
            </div>
          }
        />
      </Card>
    </PageContainer>
  );
}
