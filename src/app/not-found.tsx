import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("err.notFound") };
}

export default async function NotFound() {
  const t = await getT();
  return (
    <PageContainer size="form" className="py-10">
      <Card className="flex flex-col items-center py-12 text-center">
        <p className="text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">404</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t("err.notFound")}</h1>
        <p className="mt-2 max-w-sm text-fg-muted">
          {t("err.notFoundBody")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">{t("err.backHome")}</ButtonLink>
          <ButtonLink href="/price" variant="outline">
            {t("err.viewPrices")}
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
