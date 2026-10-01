import type { Metadata } from "next";
import Link from "next/link";
import { ApiReference } from "@/components/marketplace/ApiReference";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { siteConfig } from "@/config/site";
import { API_SECTIONS } from "@/content/api-docs";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: "API", description: t("api.metaDescription", { name: siteConfig.name }) };
}

export default async function ApiPage() {
  const t = await getT();
  return (
    <PageContainer className="space-y-6">
      <h1 className="pt-2 text-3xl font-semibold tracking-tight">{siteConfig.name} API</h1>

      <Card className="grid gap-6 lg:grid-cols-[1fr_auto] lg:!p-6">
        <div className="space-y-2 text-[17px] leading-relaxed lg:border-e lg:border-line lg:pe-8">
          <p>{t("api.intro")}</p>
          <p className="text-primary">{t("api.auth")}</p>
          <Alert className="mt-3">
            {t("api.amounts")}{" "}
            <code dir="ltr">Authorization: Bearer &lt;key&gt;</code>
          </Alert>
          <p className="text-sm text-fg-muted">{t("api.referenceNote")}</p>
        </div>
        <ul className="space-y-2.5 text-[17px] font-medium lg:ps-2">
          <li>
            <Link href="/profile/settings" className="underline decoration-1 underline-offset-4 hover:text-primary">
              {t("api.getKey")}
            </Link>
          </li>
          <li>
            <Link href="/faq" className="underline decoration-1 underline-offset-4 hover:text-primary">
              {t("nav.faq")}
            </Link>
          </li>
        </ul>
      </Card>

      <Card className="lg:!p-6" dir="ltr" lang="en">
        <ApiReference sections={API_SECTIONS} />
      </Card>
    </PageContainer>
  );
}
