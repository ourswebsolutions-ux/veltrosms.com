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

/** wa.me link for receiving a Ready Made purchase, prefilled with the order details. Safe on server and client. */
export function readyMadeWhatsappHref(
  whatsappDigits: string,
  order: { reference: string; service: string; country: string | null; email?: string },
) {
  const lines = [
    `Hello, I purchased a Ready Made account on ${siteConfig.name} and would like to receive it.`,
    `Order: ${order.reference}`,
    `Service: ${order.service}`,
    `Country: ${order.country ?? "All countries"}`,
    ...(order.email ? [`Email: ${order.email}`] : []),
  ];
  return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
