import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.terms") };
}

export default async function TermsPage() {
  const t = await getT();
  return (
    <LegalPage
      title={t("nav.terms")}
      sections={[
        { heading: t("terms.service"), body: t("terms.serviceBody") },
        { heading: t("terms.accounts"), body: t("terms.accountsBody") },
        { heading: t("terms.acceptable"), body: t("terms.acceptableBody") },
        { heading: t("terms.api"), body: t("terms.apiBody") },
        { heading: t("terms.liability"), body: t("terms.liabilityBody") },
        { heading: t("terms.changes"), body: t("terms.changesBody") },
      ]}
    />
  );
}
