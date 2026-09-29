"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";

/** Admin error boundary: generic message only (no internals in the page). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("[admin] page error", error.digest ?? ""), [error]);
  return (
    <Card>
      <ErrorState title="This admin page couldn't load" description="Nothing was changed. Try again, or check the server logs." action={<Button onClick={reset}>Try again</Button>} />
    </Card>
  );
}
