import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Disclosure row built on <details>, so it works without JavaScript and is
 * searchable with the browser's find-in-page.
 */
export function AccordionItem({
  title,
  children,
  className,
  defaultOpen,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-xl bg-surface shadow-card [&_summary::-webkit-details-marker]:hidden",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-base text-fg sm:px-5 sm:text-[17px]">
        <span>{title}</span>
        <span className="relative size-5 shrink-0 text-primary" aria-hidden="true">
          <span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 rounded bg-current" />
          <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 rounded bg-current transition-transform group-open:scale-y-0" />
        </span>
      </summary>
      <div className="px-4 pb-5 text-[15px] leading-relaxed text-fg-muted sm:px-5">{children}</div>
    </details>
  );
}
