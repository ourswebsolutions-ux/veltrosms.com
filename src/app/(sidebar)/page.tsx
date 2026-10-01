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
import { getPopularOffers, listCountries, listServices } from "@/server/services/catalog.service";

export default async function HomePage() {
  const [popular, services, countries] = await Promise.all([getPopularOffers(), listServices(), listCountries()]);

  return (
    <>
      <PromoCarousel />

      <Card>
        <PageHeader
          as="h2"
          size="lg"
          title="Customer favorites"
          description={`${services.length} services in ${countries.length} countries`}
          actions={
            <ButtonLink href="/price" size="sm" variant="ghost">
              All prices <Icon name="arrowRight" size={16} />
            </ButtonLink>
          }
          className="mb-4"
        />
        {popular.status !== "ok" ? (
          <EmptyState compact icon="phone" title="Numbers coming soon" description={popular.message} />
        ) : popular.data.length === 0 ? (
          <EmptyState compact title="Nothing in stock right now" />
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
                    <span className="block truncate text-[15px] font-medium text-fg">{g.service.name}</span>
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
        <QuickLink icon="code" title="Developer API" href="/api" linkLabel="Read the docs" />
        <QuickLink icon="cpu" title="Partner software" href="/software" linkLabel="Browse tools" />
        <QuickLink icon="wallet" title="Add funds" href="/profile/top-up" linkLabel="Top up balance" />
      </div>

      <HowItWorks />

      <Benefits />

      <Card className="border border-line bg-[linear-gradient(180deg,var(--color-surface-sunken)_0%,var(--color-surface-muted)_40%)] shadow-none">
        <p className="text-lg font-medium text-primary">About our service</p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-[28px]">
          Temporary phone numbers for one-time codes
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-fg-muted">
          <p>
            {siteConfig.name} gives you a real phone number for the few minutes you need to
            receive a verification code. Choose a service and a country, pay only for the
            activation, and the SMS appears in your account the moment it arrives.
          </p>
          <p className="font-semibold text-fg">Why people use virtual numbers</p>
          <p>
            Keep your personal number private, register separate accounts for work and testing,
            or verify a service that isn&apos;t available with your local number. If no code
            arrives, the activation can be cancelled and the funds return to your balance.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/register">Create a free account</ButtonLink>
          <ButtonLink href="/price" variant="outline">
            View prices
          </ButtonLink>
        </div>
      </Card>

      <FaqPreview />

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

const STEPS: { icon: IconName; title: string }[] = [
  { icon: "user", title: "Create an account" },
  { icon: "wallet", title: "Top up your balance" },
  { icon: "message", title: "Receive SMS from any service" },
];

function HowItWorks() {
  return (
    <Card>
      <h2 className="text-2xl font-semibold sm:text-[28px]">How it works</h2>
      <p className="mt-1 text-[15px] text-fg-muted">
        Get verification codes on a virtual number in three steps.
      </p>
      <ol className="mt-6 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative">
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-10 left-24 hidden h-px w-[calc(100%-6rem)] border-t-2 border-dashed border-primary-tint-border sm:block"
              />
            )}
            <span className="flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgba(15,59,106,0.35)]">
              <Icon name={step.icon} size={34} strokeWidth={1.6} />
            </span>
            <p className="mt-4 max-w-40 text-lg leading-snug font-semibold">{step.title}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[15px] text-fg-muted">
        Numbers for popular services in dozens of countries.{" "}
        <Link href="/register" className="text-primary hover:underline">
          Sign up
        </Link>{" "}
        to get started.
      </p>
    </Card>
  );
}

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "wallet", title: "Pay only for codes", body: "If no SMS arrives, cancel the activation and the charge returns to your balance." },
  { icon: "zap", title: "Codes in seconds", body: "Messages appear in your account the moment they reach the number." },
  { icon: "globe", title: "Many countries", body: "Choose from numbers in dozens of countries for popular services." },
  { icon: "code", title: "Built for automation", body: "Use the HTTP API to request numbers and read codes from your own software." },
];

function Benefits() {
  return (
    <Card>
      <PageHeader as="h2" size="lg" title="Why choose us" className="mb-4" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-xl bg-surface-muted p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <Icon name={b.icon} size={20} />
            </span>
            <div>
              <p className="font-semibold">{b.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FaqPreview() {
  return (
    <section aria-labelledby="faq-preview">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 id="faq-preview" className="text-[26px] font-semibold tracking-tight sm:text-[32px]">
          Questions and answers
        </h2>
        <ButtonLink href="/faq" size="sm" variant="ghost">
          All questions <Icon name="arrowRight" size={16} />
        </ButtonLink>
      </div>
      <div className="space-y-2.5">
        {FAQ.slice(0, 4).map((entry) => (
          <AccordionItem key={entry.question} title={entry.question}>
            {entry.answer.map((p) => (
              <p key={p} className="mt-2 first:mt-0">
                {p}
              </p>
            ))}
          </AccordionItem>
        ))}
      </div>
    </section>
  );
}
