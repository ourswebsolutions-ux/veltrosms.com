import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { siteConfig } from "@/config/site";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.legal") };
}

export default async function LegalInfoPage() {
  const t = await getT();
  return (
    <LegalPage
      title={t("nav.legal")}
      sections={[
        { heading: t("legal.operator"), body: t("site.legalEntity") },
        {
          heading: t("legal.contact"),
          body: (
            <a className="text-primary hover:underline" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
          ),
        },
        { heading: t("legal.complaints"), body: t("legal.complaintsBody") },
      ]}
    />
  );
}
