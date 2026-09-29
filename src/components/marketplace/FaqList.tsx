"use client";

import { useState } from "react";
import { AccordionItem } from "@/components/ui/Accordion";
import { SearchInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import type { FaqEntry } from "@/content/faq";

export function FaqList({ entries }: { entries: FaqEntry[] }) {
  const [query, setQuery] = useState("");
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
        placeholder="Search questions"
        aria-label="Search questions"
        className="mb-5 max-w-[260px]"
      />
      {visible.length === 0 ? (
        <EmptyState compact icon="search" title="No matching questions" description="Try other keywords or ask us below." />
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
