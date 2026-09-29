import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "./Breadcrumbs";

/**
 * Page/section heading: optional breadcrumbs, title (+ inline badge),
 * description and right-aligned actions that wrap below on narrow screens.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  as: Heading = "h1",
  size = "md",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  badge?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-4" />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Heading
              className={cn(
                "font-semibold tracking-tight text-fg",
                size === "lg" ? "text-[26px] sm:text-[32px]" : "text-[22px] sm:text-[26px]",
              )}
            >
              {title}
            </Heading>
            {badge}
          </div>
          {description && <p className="mt-1 text-[15px] text-fg-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
