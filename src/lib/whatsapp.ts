import { siteConfig } from "@/config/site";
import type { Translator } from "@/i18n/translate";
import type { ManualPaymentDetails } from "@/types/account";

/**
 * wa.me links with a prefilled message in the visitor's language. The number
 * is the site's support WhatsApp (siteConfig.supportWhatsApp, or the admin's
 * setting), normalized on the server to international digits
 * (e.g. 923024966223). Safe on server and client.
 */
export function whatsappHref(
  details: Pick<ManualPaymentDetails, "whatsappDigits">,
  context: { email?: string; reference?: string } = {},
  t?: Translator,
) {
  if (!details.whatsappDigits) return null;
  const lines = [
    t ? t("wa.topUpHello", { name: siteConfig.name }) : `Hello, I need help adding funds to my ${siteConfig.name} account.`,
    ...(context.email ? [`${t ? t("common.email") : "Email"}: ${context.email}`] : []),
    ...(context.reference ? [`${t ? t("wa.request") : "Request"}: ${context.reference}`] : []),
  ];
  return `https://wa.me/${details.whatsappDigits}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/** wa.me link for receiving a Ready Made purchase, prefilled with the order details (reference, service, country). */
export function readyMadeWhatsappHref(
  whatsappDigits: string,
  order: { reference: string; service: string; country: string | null; email?: string },
  t?: Translator,
) {
  const tr = (key: Parameters<Translator>[0], fallback: string, vars?: Record<string, string>) => (t ? t(key, vars) : fallback);
  const lines = [
    tr("wa.readyHello", `Hello, I purchased a Ready Made account on ${siteConfig.name} and would like to receive it.`, { name: siteConfig.name }),
    `${tr("wa.order", "Order")}: ${order.reference}`,
    `${tr("common.service", "Service")}: ${order.service}`,
    `${tr("common.country", "Country")}: ${order.country ?? tr("common.allCountries", "All countries")}`,
    ...(order.email ? [`${tr("common.email", "Email")}: ${order.email}`] : []),
  ];
  return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(lines.join("\n"))}`;
}
