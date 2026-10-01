import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { SoftwareApply } from "@/components/marketplace/SoftwareApply";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("software.metaTitle"), description: t("software.metaDescription", { name: siteConfig.name }) };
}

export default async function SoftwarePage() {
  const t = await getT();
  return (
    <PageContainer size="narrow" className="space-y-4">
      <Card className="flex items-center gap-8 sm:!p-10">
        <div className="flex-1">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-[34px]">{t("software.title")}</h1>
          <p className="mt-4 text-base leading-relaxed font-medium">{t("software.intro", { name: siteConfig.name })}</p>
        </div>
        <span
          aria-hidden="true"
          className="hidden size-44 shrink-0 rotate-3 items-center justify-center rounded-[40px] bg-[linear-gradient(145deg,#1f5a96,#0f3b6a)] text-white shadow-[0_18px_40px_rgba(15,59,106,0.35)] md:flex"
        >
          <Icon name="settings" size={92} strokeWidth={1.4} />
        </span>
      </Card>

      <Card className="sm:!p-10">
        <h2 className="text-xl font-medium">{t("software.catalog")}</h2>
        <EmptyState icon="cpu" title={t("software.empty")} description={t("software.emptyHint")} />
      </Card>

      <Card id="developers" className="grid scroll-mt-36 items-center gap-8 sm:!p-10 md:grid-cols-[200px_1fr]">
        <span aria-hidden="true" className="mx-auto hidden size-40 items-center justify-center rounded-full bg-primary-tint text-primary md:flex">
          <Icon name="code" size={72} strokeWidth={1.4} />
        </span>
        <div>
          <h2 className="text-2xl font-medium">{t("software.developing")}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{t("software.developingBody")}</p>
          <div className="mt-6">
            <SoftwareApply />
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
