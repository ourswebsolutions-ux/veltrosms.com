import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";

export function Breadcrumbs({
  items,
  className,
}: {
  items: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-[13px]", className)}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && (
              <li aria-hidden="true" className="text-fg-subtle">
                /
              </li>
            )}
            <li>
              {item.href ? (
                <Link href={item.href} className="text-primary hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-fg">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
