import type { ReactNode } from "react";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";

/** Shared shell for legal documents. Content is placeholder until legal review. */
export function LegalPage({
  title,
  sections,
}: {
  title: string;
  sections: { heading: string; body: ReactNode }[];
}) {
  return (
    <PageContainer size="narrow">
      <Card className="sm:!p-10">
        <PageHeader
          title={title}
          size="lg"
          breadcrumbs={[{ label: "Home", href: "/" }, { label: title }]}
        />
        <Alert tone="warning" title="Placeholder document" className="mb-8">
          The final text will be published after legal review. The outline below shows the
          topics it will cover.
        </Alert>
        <div className="space-y-6">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{s.body}</div>
            </section>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
