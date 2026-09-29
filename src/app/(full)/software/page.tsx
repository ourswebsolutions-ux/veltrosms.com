import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { SoftwareApply } from "@/components/marketplace/SoftwareApply";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Software",
  description: `Partner software compatible with ${siteConfig.name}.`,
};

export default function SoftwarePage() {
  return (
    <PageContainer size="narrow" className="space-y-4">
      <Card className="flex items-center gap-8 sm:!p-10">
        <div className="flex-1">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-[34px]">
            Software for account registration from our partners
          </h1>
          <p className="mt-4 text-base leading-relaxed font-medium">
            Tools that automate registration and verification using {siteConfig.name} numbers.
            Every listed program is checked for compatibility with our API before it appears
            here, along with its activation statistics on our service.
          </p>
        </div>
        <span
          aria-hidden="true"
          className="hidden size-44 shrink-0 rotate-3 items-center justify-center rounded-[40px] bg-[linear-gradient(145deg,#1f5a96,#0f3b6a)] text-white shadow-[0_18px_40px_rgba(15,59,106,0.35)] md:flex"
        >
          <Icon name="settings" size={92} strokeWidth={1.4} />
        </span>
      </Card>

      <Card className="sm:!p-10">
        <h2 className="text-xl font-medium">Software catalog</h2>
        <EmptyState
          icon="cpu"
          title="No partner software listed yet"
          description="Compatible tools will appear here as developers join. Building one? Apply below."
        />
      </Card>

      <Card id="developers" className="grid scroll-mt-36 items-center gap-8 sm:!p-10 md:grid-cols-[200px_1fr]">
        <span
          aria-hidden="true"
          className="mx-auto hidden size-40 items-center justify-center rounded-full bg-primary-tint text-primary md:flex"
        >
          <Icon name="code" size={72} strokeWidth={1.4} />
        </span>
        <div>
          <h2 className="text-2xl font-medium">Developing software?</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
            Join our developer partner program and earn from the activations your users make.
            Tell us about your product and the services it supports — we&apos;ll review it and
            get back to you with integration details.
          </p>
          <div className="mt-6">
            <SoftwareApply />
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
