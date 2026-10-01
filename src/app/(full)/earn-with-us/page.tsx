import type { Metadata } from "next";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { FeatureCard, HeroBanner } from "@/components/marketplace/HeroBanner";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { siteConfig } from "@/config/site";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("earn.metaTitle"), description: t("earn.metaDescription") };
}

const STEPS = [
  { title: "earn.step1", body: "earn.step1Body" },
  { title: "earn.step2", body: "earn.step2Body" },
  { title: "earn.step3", body: "earn.step3Body" },
] as const;

export default async function EarnWithUsPage() {
  const t = await getT();
  return (
    <PageContainer className="space-y-8 lg:space-y-12">
      <HeroBanner icon="trendingUp">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-[40px]">{t("earn.heroTitle")}</h1>
        <ul className="mt-4 list-disc space-y-1.5 ps-5 text-lg sm:text-xl">
          <li>{t("earn.hero1")}</li>
          <li>{t("earn.hero2")}</li>
          <li>{t("earn.hero3")}</li>
        </ul>
      </HeroBanner>

      <Card id="apply" className="sm:!p-10">
        <h2 className="mb-6 text-center text-2xl font-semibold sm:text-[28px]">{t("earn.becomePartner")}</h2>
        <PartnerForm kind="provider" />
      </Card>

      <Card className="sm:!p-10">
        <h2 className="mb-6 text-2xl font-semibold sm:text-[28px]">{t("earn.advantages", { name: siteConfig.name })}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon="zap" title={t("earn.simpleStart")}>
            {t("earn.simpleStartBody")}
          </FeatureCard>
          <FeatureCard icon="chart" title={t("earn.transparent")}>
            {t("earn.transparentBody")}
          </FeatureCard>
          <FeatureCard icon="wallet" title={t("earn.withdrawals")}>
            {t("earn.withdrawalsBody")}
          </FeatureCard>
        </div>
      </Card>

      <section>
        <h2 className="mb-5 text-2xl font-semibold sm:text-[28px]">{t("earn.needTitle")}</h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-[var(--radius-card)] border border-primary bg-primary-tint p-6 sm:p-8">
              <p className="text-sm font-semibold text-fg-muted">{t("earn.stepN", { n: i + 1 })}</p>
              <h3 className="mt-1 text-xl font-semibold text-primary">{t(step.title)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{t(step.body)}</p>
            </li>
          ))}
        </ol>
      </section>
    </PageContainer>
  );
}
