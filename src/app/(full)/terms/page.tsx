import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      sections={[
        { heading: "The service", body: "Temporary virtual numbers for receiving SMS verification codes." },
        { heading: "Accounts and balance", body: "Registration, top-ups, charges and refunds for unsuccessful activations." },
        { heading: "Acceptable use", body: "Prohibited activities and the consequences of misuse." },
        { heading: "API use", body: "Rate limits, key security and responsibilities of integrators." },
        { heading: "Liability", body: "Limits of liability and service availability." },
        { heading: "Changes", body: "How we notify you about changes to these terms." },
      ]}
    />
  );
}
