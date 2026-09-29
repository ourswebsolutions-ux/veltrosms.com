import { siteConfig } from "@/config/site";
import type { ManualPaymentDetails } from "@/types/account";

/** wa.me link with a prefilled help message (the number is normalized on the server). Safe on server and client. */
export function whatsappHref(details: Pick<ManualPaymentDetails, "whatsappDigits">, context: { email?: string; reference?: string } = {}) {
  if (!details.whatsappDigits) return null;
  const lines = [
    `Hello, I need help adding funds to my ${siteConfig.name} account.`,
    ...(context.email ? [`Email: ${context.email}`] : []),
    ...(context.reference ? [`Request: ${context.reference}`] : []),
  ];
  return `https://wa.me/${details.whatsappDigits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
