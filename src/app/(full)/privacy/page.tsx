import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.privacy") };
}

export default async function PrivacyPage() {
  const t = await getT();
  return (
    <LegalPage
      title={t("nav.privacy")}
      sections={[
        { heading: t("privacy.collect"), body: t("privacy.collectBody") },
        { heading: t("privacy.use"), body: t("privacy.useBody") },
        { heading: t("privacy.cookies"), body: t("privacy.cookiesBody") },
        { heading: t("privacy.sharing"), body: t("privacy.sharingBody") },
        { heading: t("privacy.rights"), body: t("privacy.rightsBody") },
        { heading: t("legal.contact"), body: t("privacy.contactBody") },
      ]}
    />
  );
}
