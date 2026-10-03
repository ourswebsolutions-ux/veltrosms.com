import type { Metadata } from "next";
import Link from "next/link";
import { FeatureGrid, TRUST, USE_CASES } from "@/components/home/AboutService";
import { Icon, type IconName } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { siteConfig } from "@/config/site";
import type { MessageKey } from "@/i18n/translate";
import { getT } from "@/i18n/server";
import { readyMadeContact } from "@/server/services/ready-made.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("nav.about"), description: t("about.metaDescription", { name: siteConfig.name }) };
}

const NUMBER_STEPS: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "user", title: "about.step1", body: "about.step1Body" },
  { icon: "wallet", title: "about.step2", body: "about.step2Body" },
  { icon: "grid", title: "about.step3", body: "about.step3Body" },
  { icon: "message", title: "about.step4", body: "about.step4Body" },
];

const FEATURES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "wallet", title: "home.b1", body: "home.b1Body" },
  { icon: "zap", title: "home.b2", body: "home.b2Body" },
  { icon: "globe", title: "home.b3", body: "home.b3Body" },
  { icon: "box", title: "about.feat1", body: "about.feat1Body" },
  { icon: "trendingUp", title: "about.feat2", body: "about.feat2Body" },
  { icon: "code", title: "home.b4", body: "home.b4Body" },
];

/** About our service: what we provide, how it works, what it's for, why trust it, how to reach us. */
export default async function AboutPage() {
  const [t, contact] = await Promise.all([getT(), readyMadeContact()]);
  const name = siteConfig.name;

  return (
    <PageContainer size="narrow" className="space-y-4">
      <Card className="sm:!p-8">
        <p className="text-lg font-medium text-primary">{t("home.about")}</p>
        <h1 className="mt-1 text-[26px] leading-tight font-bold sm:text-4xl">{t("about.heroTitle", { name })}</h1>
        <div className="mt-4 max-w-3xl space-y-3 text-[16px] leading-relaxed text-fg-muted">
          <p>{t("home.aboutP1", { name })}</p>
          <p>{t("about.readyMadeP", { name })}</p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/price">{t("home.viewPrices")}</ButtonLink>
          <ButtonLink href="/accounts" variant="outline">
            {t("nav.readyMade")}
          </ButtonLink>
        </div>
      </Card>

      <Card className="sm:!p-8">
        <PageHeader as="h2" size="lg" title={t("about.howTitle")} description={t("about.howIntro")} />
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {NUMBER_STEPS.map((s, i) => (
            <li key={s.title} className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-4">
              <span className="flex items-center gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Icon name={s.icon} size={20} />
                </span>
                <span className="text-sm font-semibold text-fg-muted">{t("earn.stepN", { n: i + 1 })}</span>
              </span>
              <p className="font-semibold">{t(s.title)}</p>
              <p className="text-sm leading-relaxed text-fg-muted">{t(s.body)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex gap-3 rounded-xl bg-primary-tint/50 p-4">
          <Icon name="box" size={22} className="mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold">{t("about.readyMadeTitle")}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{t("about.readyMadeFlow")}</p>
          </div>
        </div>
      </Card>

      <Card className="sm:!p-8">
        <PageHeader as="h2" size="lg" title={t("about.useTitle")} />
        <FeatureGrid items={USE_CASES} t={t} />
      </Card>

      <Card className="sm:!p-8">
        <PageHeader as="h2" size="lg" title={t("about.featuresTitle")} />
        <FeatureGrid items={FEATURES} t={t} />
      </Card>

      <Card className="sm:!p-8">
        <PageHeader as="h2" size="lg" title={t("about.trustTitle")} />
        <FeatureGrid items={TRUST} t={t} />
      </Card>

      <Card className="sm:!p-8">
        <PageHeader as="h2" size="lg" title={t("about.contactTitle")} description={t("about.contactIntro")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <a
            href={`https://wa.me/${contact.whatsappDigits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-[#25d366] hover:bg-[#25d366]/10"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-white">
              <Icon name="message" size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t("rm.whatsapp")}</span>
              <span dir="ltr" className="block text-sm text-fg-muted">
                {contact.whatsapp}
              </span>
            </span>
          </a>
          <a href={`mailto:${siteConfig.supportEmail}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-primary hover:bg-primary-tint/40">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Icon name="mail" size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t("common.email")}</span>
              <span className="block text-sm wrap-anywhere text-fg-muted">{siteConfig.supportEmail}</span>
            </span>
          </a>
          <Link href="/faq" className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-primary hover:bg-primary-tint/40">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <Icon name="inbox" size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t("nav.faq")}</span>
              <span className="block text-sm text-fg-muted">{t("about.faqHint")}</span>
            </span>
          </Link>
        </div>
      </Card>

      <Card className="text-center sm:!p-8">
        <h2 className="text-2xl font-semibold">{t("about.ctaTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-fg-muted">{t("about.ctaBody")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/register">{t("home.createFree")}</ButtonLink>
          <ButtonLink href="/blog" variant="outline">
            {t("about.readBlog")}
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
