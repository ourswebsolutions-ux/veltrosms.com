import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { getT } from "@/i18n/server";

/**
 * Centered stack of cards shared by every auth page (log in, sign up,
 * verification, password reset), following the reference's authorization page.
 */
export async function AuthShell({
  title,
  description,
  notice,
  children,
  switchLink,
}: {
  title: string;
  description?: ReactNode;
  /** Banner above the form, e.g. "Email confirmed". */
  notice?: ReactNode;
  children: ReactNode;
  switchLink?: { prompt: string; label: string; href: string };
}) {
  const t = await getT();
  return (
    <PageContainer size="form" className="space-y-5 pt-4">
      <Breadcrumbs items={[{ label: t("common.home"), href: "/" }, { label: title }]} className="flex justify-center" />
      <div className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="mx-auto mt-2 max-w-md text-[15px] text-fg-muted">{description}</p>}
      </div>
      <Card className="sm:!px-10 sm:!py-8">
        <div className="mx-auto max-w-[560px] space-y-4">
          {notice}
          {children}
        </div>
      </Card>
      {switchLink && (
        <Card className="flex flex-wrap items-center justify-center gap-3 !py-5 text-center">
          <span className="text-lg text-fg-muted">{switchLink.prompt}</span>
          <Link
            href={switchLink.href}
            className="rounded-md border border-primary px-6 py-1 text-[15px] font-medium text-primary transition-colors hover:bg-primary-tint"
          >
            {switchLink.label}
          </Link>
        </Card>
      )}
    </PageContainer>
  );
}
