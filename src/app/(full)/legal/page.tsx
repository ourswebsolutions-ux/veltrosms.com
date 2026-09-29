import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Legal information" };

export default function LegalInfoPage() {
  return (
    <LegalPage
      title="Legal information"
      sections={[
        { heading: "Operator", body: siteConfig.legalEntity },
        { heading: "Contact", body: <a className="text-primary hover:underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> },
        { heading: "Complaints", body: "How to file a complaint and expected response times." },
      ]}
    />
  );
}
