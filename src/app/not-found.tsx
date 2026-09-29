import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageContainer size="form" className="py-10">
      <Card className="flex flex-col items-center py-12 text-center">
        <p className="text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">404</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Page not found</h1>
        <p className="mt-2 max-w-sm text-fg-muted">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">Back to homepage</ButtonLink>
          <ButtonLink href="/price" variant="outline">
            View prices
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
