import type { Metadata } from "next";
import Link from "next/link";
import { ApiReference } from "@/components/marketplace/ApiReference";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { siteConfig } from "@/config/site";
import { API_SECTIONS } from "@/content/api-docs";

export const metadata: Metadata = {
  title: "API",
  description: `Automate SMS activations with the ${siteConfig.name} HTTP API.`,
};

export default function ApiPage() {
  return (
    <PageContainer className="space-y-6">
      <h1 className="pt-2 text-3xl font-semibold tracking-tight">{siteConfig.name} API</h1>

      <Card className="grid gap-6 lg:grid-cols-[1fr_auto] lg:!p-6">
        <div className="space-y-2 text-[17px] leading-relaxed lg:border-r lg:border-line lg:pr-8">
          <p>
            The API lets your software request numbers and read incoming SMS automatically — the
            same actions you perform on the website, over HTTPS with JSON responses.
          </p>
          <p className="text-primary">
            Authenticated requests use your personal API key, sent as a Bearer token.
          </p>
          <Alert className="mt-3">
            Amounts are integers in 1/10,000 of the currency unit (4200 = 0.42). Create your API key in
            Settings and send it as <code>Authorization: Bearer &lt;key&gt;</code>.
          </Alert>
        </div>
        <ul className="space-y-2.5 text-[17px] font-medium lg:pl-2">
          <li>
            <Link href="/profile/settings" className="underline decoration-1 underline-offset-4 hover:text-primary">
              Get your API key
            </Link>
          </li>
          <li>
            <Link href="/faq" className="underline decoration-1 underline-offset-4 hover:text-primary">
              FAQ
            </Link>
          </li>
        </ul>
      </Card>

      <Card className="lg:!p-6">
        <ApiReference sections={API_SECTIONS} />
      </Card>
    </PageContainer>
  );
}
