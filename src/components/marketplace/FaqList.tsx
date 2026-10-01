"use client";

import { useState } from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import type { FaqText } from "@/content/faq";
import { useT } from "@/i18n/client";

export function FaqList({ entries }: { entries: FaqText[] }) {
  const [query, setQuery] = useState("");
  const t = useT();
  const q = query.trim().toLowerCase();
  const visible = q
    ? entries.filter(
        (e) =>
          e.question.toLowerCase().includes(q) ||
          e.answer.some((a) => a.toLowerCase().includes(q)),
      )
    : entries;

  return (
    <>
      <SearchInput
        size="sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("faq.search")}
        aria-label={t("faq.search")}
        className="mb-5 max-w-[260px]"
      />
      {visible.length === 0 ? (
        <EmptyState compact icon="search" title={t("faq.noMatch")} description={t("faq.noMatchHint")} />
      ) : (
        <div className="space-y-2.5">
          {visible.map((entry) => (
            <AccordionItem key={entry.question} title={entry.question}>
              {entry.answer.map((p) => (
                <p key={p} className="mt-2 first:mt-0">
                  {p}
                </p>
              ))}
            </AccordionItem>
          ))}
        </div>
      )}
    </>
  );
}
