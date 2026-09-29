import type { Metadata } from "next";
import { PartnerForm } from "@/components/forms/PartnerForm";
import { FeatureCard, HeroBanner } from "@/components/marketplace/HeroBanner";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Earn with us",
  description: "Connect your phone numbers and earn from SMS activations.",
};

const STEPS = [
  {
    title: "Submit a request",
    body: "Tell us about your numbers. We reply within one business day with everything you need to get connected.",
  },
  {
    title: "Set up the integration",
    body: "Connect over our provider API, or through supported SIM-bank and GSM-gateway software.",
  },
  {
    title: "Manage your pricing",
    body: "Set prices per service in the partner dashboard and follow your sales statistics in real time.",
  },
];

export default function EarnWithUsPage() {
  return (
    <PageContainer className="space-y-8 lg:space-y-12">
      <HeroBanner icon="trendingUp">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-[40px]">Become our partner</h1>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-lg sm:text-xl">
          <li>Monetize the phone numbers you already have.</li>
          <li>Receive one-time codes on them for our customers and get paid.</li>
          <li>Connect once and start earning.</li>
        </ul>
      </HeroBanner>

      <Card id="apply" className="sm:!p-10">
        <h2 className="mb-6 text-center text-2xl font-semibold sm:text-[28px]">Become a partner</h2>
        <PartnerForm kind="provider" />
      </Card>

      <Card className="sm:!p-10">
        <h2 className="mb-6 text-2xl font-semibold sm:text-[28px]">
          Advantages of working with {siteConfig.name}
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <FeatureCard icon="zap" title="Simple start">
            Free to join, with no hidden fees or complicated checks.
          </FeatureCard>
          <FeatureCard icon="chart" title="Transparent income">
            Every successful activation is paid and shown in your statistics.
          </FeatureCard>
          <FeatureCard icon="wallet" title="Easy withdrawals">
            Request a payout whenever you like from the partner dashboard.
          </FeatureCard>
        </div>
      </Card>

      <section>
        <h2 className="mb-5 text-2xl font-semibold sm:text-[28px]">What do you need to get started?</h2>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-[var(--radius-card)] border border-primary bg-primary-tint p-6 sm:p-8">
              <p className="text-sm font-semibold text-fg-muted">Step {i + 1}</p>
              <h3 className="mt-1 text-xl font-semibold text-primary">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </PageContainer>
  );
}
