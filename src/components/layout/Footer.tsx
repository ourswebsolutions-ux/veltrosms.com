import Link from "next/link";
import { PageContainer } from "@/components/ui/PageContainer";
import { footerAccountNav, footerNav, legalNav, siteConfig } from "@/config/site";
import { Logo } from "./Logo";
import { getT } from "@/i18n/server";
import { Icon } from "@/components/icons";
import { readyMadeContact } from "@/server/services/ready-made.service";
import { ChatbotActivator } from "./ChatbotActivator";

/**
 * Three rows, following the reference's information architecture:
 * brand + tagline · product links (+ account links) · legal line.
 */
export async function Footer() {
  const [t, contact] = await Promise.all([getT(), readyMadeContact().catch(() => null)]);
  return (
    <footer className="mt-10 bg-surface">
      <PageContainer>
        <div className="flex flex-col gap-3 border-b border-line py-6 sm:flex-row sm:items-center sm:gap-8">
          <Logo />
          <p className="max-w-60 text-[15px] leading-snug font-medium text-primary">{t("site.tagline")}</p>
          <div className="flex flex-col gap-1.5 text-sm text-fg-muted sm:ms-auto sm:items-end">
            {contact && (
              <a href={`https://wa.me/${contact.whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-primary">
                <Icon name="message" size={16} className="text-[#25d366]" />
                {t("rm.whatsapp")}: <span dir="ltr">{contact.whatsapp}</span>
              </a>
            )}
            <a href={`mailto:${siteConfig.supportEmail}`} className="inline-flex items-center gap-1.5 hover:text-primary">
              <Icon name="mail" size={16} />
              {siteConfig.supportEmail}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 border-b border-line py-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <nav aria-label={t("nav.footer")}>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-between lg:gap-x-10">
              {footerNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-lg text-fg-muted transition-colors hover:text-primary">
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t("nav.account")} className="lg:border-s lg:border-line lg:ps-10">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {footerAccountNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-fg-muted transition-colors hover:text-primary">
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-3 py-5 text-[13px] text-fg-muted lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. {t("site.legalEntity")}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-primary hover:underline">
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="pb-4 text-[13px] text-fg-muted">
          <ChatbotActivator />
        </p>
      </PageContainer>
    </footer>
  );
}
