import type { Metadata } from "next";
import { FeedbackForm } from "@/components/forms/FeedbackForm";
import { Icon } from "@/components/icons";
import { FaqList } from "@/components/marketplace/FaqList";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FAQ } from "@/content/faq";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.faq") };
}

export default async function FaqPage() {
  const t = await getT();
  const entries = FAQ.map((e) => ({ question: t(e.question), answer: e.answer.map((a) => t(a)) }));
  return (
    <>
      <section className="px-1 pt-1 sm:px-5">
        <Breadcrumbs items={[{ label: t("common.home"), href: "/" }, { label: t("nav.faq") }]} className="mb-5 lg:flex lg:justify-center" />
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-4 text-3xl font-semibold">{t("nav.faq")}</h1>
          <span
            aria-hidden="true"
            className="hidden size-20 -rotate-6 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_10px_24px_rgba(15,59,106,0.35)] sm:flex"
          >
            <span className="text-5xl font-extrabold">?</span>
          </span>
        </div>
        <FaqList entries={entries} />
        <p className="mt-5 flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="message" size={18} className="text-primary" />
          {t("faq.askBelow")}
        </p>
      </section>
      <FeedbackForm />
    </>
  );
}
