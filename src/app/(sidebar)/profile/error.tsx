"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";

/**
 * Account-area error boundary. Shows a generic message only — never the
 * error text, which may contain internals (SQL, provider responses).
 */
export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[profile] page error", error.digest ?? "");
  }, [error]);
  return (
    <Card>
      <ErrorState
        title="We couldn't load this page"
        description="Something went wrong on our side or your connection dropped. Your balance and orders are safe."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <Icon name="refresh" size={16} /> Try again
            </Button>
            <ButtonLink href="/profile" variant="outline">
              Back to profile
            </ButtonLink>
          </div>
        }
      />
    </Card>
  );
}
