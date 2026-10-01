"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { useT } from "@/i18n/client";

/**
 * Account-area error boundary. Shows a generic message only — never the
 * error text, which may contain internals (SQL, provider responses).
 */
export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error("[profile] page error", error.digest ?? "");
  }, [error]);
  return (
    <Card>
      <ErrorState
        title={t("err.profileTitle")}
        description={t("err.profileBody")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <Icon name="refresh" size={16} /> {t("common.retry")}
            </Button>
            <ButtonLink href="/profile" variant="outline">
              {t("err.backProfile")}
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
