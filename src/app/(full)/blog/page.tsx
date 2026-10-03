import type { Metadata } from "next";
import Link from "next/link";
import { BlogCard } from "@/components/blog/BlogCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { getT } from "@/i18n/server";
import { listPublishedPosts } from "@/server/services/blog.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("blog.title"), description: t("blog.intro", { name: siteConfig.name }) };
}

const PAGE_SIZE = 12;

/** Public blog: published posts, newest first; the newest one is featured on page 1. */
export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const category = typeof sp.category === "string" ? sp.category.slice(0, 60) : undefined;
  const [t, data] = await Promise.all([getT(), listPublishedPosts({ page, pageSize: PAGE_SIZE, category })]);
  const [first, ...rest] = data.posts;
  const featured = page === 1 && first ? first : null;
  const grid = featured ? rest : data.posts;
  const href = (p: number, c = category) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader title={t("blog.title")} description={t("blog.intro", { name: siteConfig.name })} size="lg" />
      {data.categories.length > 0 && (
        <nav aria-label={t("blog.categories")} className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ label: t("blog.allCategories"), value: undefined as string | undefined }, ...data.categories.map((c) => ({ label: c, value: c }))].map((c) => (
            <Link
              key={c.label}
              href={href(1, c.value)}
              aria-current={category === c.value ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                category === c.value ? "border-primary bg-primary text-white" : "border-line bg-surface text-fg hover:border-primary hover:text-primary",
              )}
            >
              {c.label}
            </Link>
          ))}
        </nav>
      )}
      {data.posts.length === 0 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-6 shadow-card">
          <EmptyState icon="article" title={t("blog.empty")} description={t("blog.emptyHint")} />
        </div>
      ) : (
        <>
          {featured && <BlogCard post={featured} t={t} featured />}
          {grid.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((p) => (
                <BlogCard key={p.id} post={p} t={t} />
              ))}
            </div>
          )}
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={(p) => href(p)} />
        </>
      )}
    </PageContainer>
  );
}
