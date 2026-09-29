import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** White rounded panel — the basic building block of every page. */
export function Card({
  className,
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-surface shadow-card",
        padded && "p-4 sm:p-5 lg:p-6",
        className,
      )}
      {...props}
    />
  );
}

/** Card heading row with an optional "All …  →" style link on the right. */
export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-primary hover:underline"
        >
          {action.label}
          <Icon name="arrowRight" size={14} />
        </Link>
      )}
    </div>
  );
}
