import type { Metadata } from "next";
import { FeedbackForm } from "@/components/forms/FeedbackForm";
import { Icon } from "@/components/icons";
import { FaqList } from "@/components/marketplace/FaqList";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { FAQ } from "@/content/faq";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <>
      <section className="px-1 pt-1 sm:px-5">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "FAQ" }]} className="mb-5 lg:flex lg:justify-center" />
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-4 text-3xl font-semibold">FAQ</h1>
          <span
            aria-hidden="true"
            className="hidden size-20 -rotate-6 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_10px_24px_rgba(15,59,106,0.35)] sm:flex"
          >
            <span className="text-5xl font-extrabold">?</span>
          </span>
        </div>
        <FaqList entries={FAQ} />
        <p className="mt-5 flex items-center gap-2 text-sm text-fg-muted">
          <Icon name="message" size={18} className="text-primary" />
          Didn&apos;t find an answer? Send us a message below.
        </p>
      </section>
      <FeedbackForm />
    </>
  );
}
