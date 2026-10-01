import Link from "next/link";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { getT } from "@/i18n/server";

/** Page numbers to show: first, last, current ±1, with gaps as null. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const item =
  "flex size-10 items-center justify-center rounded-lg text-[15px] font-medium transition-colors";

/**
 * Link-based pagination (works without JS and keeps pages shareable).
 * `hrefFor` builds the URL for a page number.
 */
export async function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const t = await getT();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label={t("common.pagination")}
      className={cn("flex flex-col items-center gap-3 pt-5", className)}
    >
      {pageCount > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <PageLink href={page > 1 ? hrefFor(page - 1) : undefined} label={t("common.previousPage")}>
              <Icon name="chevronLeft" size={18} />
            </PageLink>
          </li>
          {pageWindow(page, pageCount).map((p, i) =>
            p === null ? (
              <li key={`gap-${i}`} className="px-1 text-fg-subtle" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                {p === page ? (
                  <span aria-current="page" className={cn(item, "bg-primary text-white")}>
                    {p}
                  </span>
                ) : (
                  <Link href={hrefFor(p)} className={cn(item, "text-fg hover:bg-surface-muted")}>
                    {p}
                  </Link>
                )}
              </li>
            ),
          )}
          <li>
            <PageLink href={page < pageCount ? hrefFor(page + 1) : undefined} label={t("common.nextPage")}>
              <Icon name="chevronRight" size={18} />
            </PageLink>
          </li>
        </ul>
      )}
      <p className="text-sm text-fg-muted">
        {t("common.showing", { from, to, total })}
      </p>
    </nav>
  );
}

function PageLink({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={cn(item, "text-fg-subtle opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(item, "text-fg hover:bg-surface-muted")}>
      {children}
    </Link>
  );
}
