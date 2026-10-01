import Link from "next/link";
import { FeedbackForm } from "@/components/forms/FeedbackForm";
import { Money } from "@/components/currency/DisplayCurrency";
import { Icon, type IconName } from "@/components/icons";
import { PromoCarousel } from "@/components/marketplace/PromoCarousel";
import { PricePill } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { AccordionItem } from "@/components/ui/Accordion";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { FAQ } from "@/content/faq";
import { getT } from "@/i18n/server";
import type { MessageKey, Translator } from "@/i18n/translate";
import { getPopularOffers, listCountries, listServices } from "@/server/services/catalog.service";

export default async function HomePage() {
  const [popular, services, countries, t] = await Promise.all([getPopularOffers(), listServices(), listCountries(), getT()]);

  return (
    <>
      <PromoCarousel />

      <Card>
        <PageHeader
          as="h2"
          size="lg"
          title={t("home.favorites")}
          description={t("home.favoritesCount", { services: services.length, countries: countries.length })}
          actions={
            <ButtonLink href="/price" size="sm" variant="ghost">
              {t("home.allPrices")} <Icon name="arrowRight" size={16} />
            </ButtonLink>
          }
          className="mb-4"
        />
        {popular.status !== "ok" ? (
          <EmptyState compact icon="phone" title={t("home.comingSoon")} description={t.server(popular.message)} />
        ) : popular.data.length === 0 ? (
          <EmptyState compact title={t("home.nothingInStock")} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 min-[1400px]:grid-cols-3">
            {popular.data.map((g) => (
              <li key={`${g.service.slug}-${g.country.id}`}>
                <Link
                  href={`/price?service=${g.service.slug}`}
                  className="flex h-12 items-center gap-2 rounded-lg border border-line px-1.5 transition-colors hover:border-primary-tint-border hover:bg-primary-tint/40"
                >
                  <ServiceAvatar name={g.service.name} color={g.service.color} logo={g.service.logo} size={30} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span dir="auto" className="block truncate text-[15px] font-medium text-fg rtl:text-right">
                      {g.service.name}
                    </span>
                    <span className="flex items-center gap-1 truncate text-[13px] text-fg-muted">
                      <CountryFlag iso2={g.country.iso2} size={14} />
                      {g.country.name}
                    </span>
                  </span>
                  <PricePill size="sm" className="min-w-[60px] justify-center">
                    <Money amount={g.minPrice} currency={g.currency} />
                  </PricePill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink icon="code" title={t("home.developerApi")} href="/api" linkLabel={t("home.readDocs")} />
        <QuickLink icon="cpu" title={t("home.partnerSoftware")} href="/software" linkLabel={t("home.browseTools")} />
        <QuickLink icon="wallet" title={t("nav.addFunds")} href="/profile/top-up" linkLabel={t("home.topUpBalance")} />
      </div>

      <HowItWorks t={t} />

      <Benefits t={t} />

      <Card className="border border-line bg-[linear-gradient(180deg,var(--color-surface-sunken)_0%,var(--color-surface-muted)_40%)] shadow-none">
        <p className="text-lg font-medium text-primary">{t("home.about")}</p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-[28px]">{t("home.aboutTitle")}</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-fg-muted">
          <p>{t("home.aboutP1", { name: siteConfig.name })}</p>
          <p className="font-semibold text-fg">{t("home.whyTitle")}</p>
          <p>{t("home.whyP")}</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/register">{t("home.createFree")}</ButtonLink>
          <ButtonLink href="/price" variant="outline">
            {t("home.viewPrices")}
          </ButtonLink>
        </div>
      </Card>

      <FaqPreview t={t} />

      <FeedbackForm />
    </>
  );
}

function QuickLink({
  icon,
  title,
  href,
  linkLabel,
}: {
  icon: IconName;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="flex h-full flex-col gap-2 !p-4 transition-shadow group-hover:shadow-pop">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary text-white">
          <Icon name={icon} size={20} />
        </span>
        <span className="text-[17px] font-medium text-fg">{title}</span>
        <span className="inline-flex items-center gap-1 text-[13px] text-primary">
          {linkLabel} <Icon name="arrowRight" size={14} />
        </span>
      </Card>
    </Link>
  );
}

const STEPS: { icon: IconName; title: MessageKey }[] = [
  { icon: "user", title: "home.step1" },
  { icon: "wallet", title: "home.step2" },
  { icon: "message", title: "home.step3" },
];

function HowItWorks({ t }: { t: Translator }) {
  return (
    <Card>
      <h2 className="text-2xl font-semibold sm:text-[28px]">{t("home.howTitle")}</h2>
      <p className="mt-1 text-[15px] text-fg-muted">{t("home.howIntro")}</p>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-10 start-24 hidden h-px w-[calc(100%-6rem)] border-t-2 border-dashed border-primary-tint-border sm:block"
              />
            )}
            <span className="flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgba(15,59,106,0.35)]">
              <Icon name={step.icon} size={34} strokeWidth={1.6} />
            </span>
            <p className="mt-4 max-w-40 text-lg leading-snug font-semibold">{t(step.title)}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[15px] text-fg-muted">
        {t("home.howOutro")}{" "}
        <Link href="/register" className="text-primary hover:underline">
          {t("home.howSignup")}
        </Link>
      </p>
    </Card>
  );
}

const BENEFITS: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "wallet", title: "home.b1", body: "home.b1Body" },
  { icon: "zap", title: "home.b2", body: "home.b2Body" },
  { icon: "globe", title: "home.b3", body: "home.b3Body" },
  { icon: "code", title: "home.b4", body: "home.b4Body" },
];

function Benefits({ t }: { t: Translator }) {
  return (
    <Card>
      <PageHeader as="h2" size="lg" title={t("home.whyUs")} className="mb-4" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-xl bg-surface-muted p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <Icon name={b.icon} size={20} />
            </span>
            <div>
              <p className="font-semibold">{t(b.title)}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{t(b.body)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FaqPreview({ t }: { t: Translator }) {
  return (
    <section aria-labelledby="faq-preview">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 id="faq-preview" className="text-[26px] font-semibold tracking-tight sm:text-[32px]">
          {t("home.faqTitle")}
        </h2>
        <ButtonLink href="/faq" size="sm" variant="ghost">
          {t("home.allQuestions")} <Icon name="arrowRight" size={16} />
        </ButtonLink>
      </div>
      <div className="space-y-2.5">
        {FAQ.slice(0, 4).map((entry) => (
          <AccordionItem key={entry.question} title={t(entry.question)}>
            {entry.answer.map((p) => (
              <p key={p} className="mt-2 first:mt-0">
                {t(p)}
              </p>
            ))}
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
