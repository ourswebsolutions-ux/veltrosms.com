import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacy & cookie policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy & cookie policy"
      sections={[
        { heading: "Data we collect", body: "Account details, order history and technical data needed to run the service." },
        { heading: "How we use it", body: "To provide numbers and codes, process payments, prevent abuse and support you." },
        { heading: "Cookies", body: "Essential cookies for sign-in and preferences; optional analytics only with consent." },
        { heading: "Sharing", body: "Only with processors required to deliver the service, under contract." },
        { heading: "Your rights", body: "Access, correction, export and deletion of your personal data." },
        { heading: "Contact", body: "How to reach us about privacy questions." },
      ]}
    />
  );
}
