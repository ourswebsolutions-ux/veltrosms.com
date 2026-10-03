import "server-only";
import { db } from "@/server/db";
import type { BlogPostSummary, BlogPostView } from "@/types/blog";

/**
 * Public blog. A post is visible only when it is published AND its
 * publication date has passed (a future date schedules it). Drafts are never
 * returned here, whatever the slug.
 */

const visible = () => ({ published: true, publishedAt: { lte: new Date() } });

const summarySelect = { id: true, slug: true, title: true, excerpt: true, featuredImage: true, category: true, publishedAt: true } as const;

const toSummary = (p: { id: number; slug: string; title: string; excerpt: string; featuredImage: string | null; category: string | null; publishedAt: Date | null }): BlogPostSummary => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  featuredImage: p.featuredImage,
  category: p.category,
  publishedAt: (p.publishedAt ?? new Date(0)).toISOString(),
});

export async function listPublishedPosts(opts: { page?: number; pageSize?: number; category?: string } = {}) {
  const pageSize = opts.pageSize ?? 12;
  const page = Math.max(1, opts.page ?? 1);
  const where = { ...visible(), ...(opts.category ? { category: opts.category } : {}) };
  const [rows, total, categories] = await Promise.all([
    db().blogPost.findMany({ where, select: summarySelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db().blogPost.count({ where }),
    db().blogPost.findMany({ where: { ...visible(), category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);
  return { posts: rows.map(toSummary), total, page, pageSize, categories: categories.map((c) => c.category!).filter(Boolean) };
}

export async function getPublishedPost(slug: string): Promise<BlogPostView | null> {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  const p = await db().blogPost.findFirst({ where: { slug, ...visible() } });
  return p ? { ...toSummary(p), content: p.content, updatedAt: p.updatedAt.toISOString() } : null;
}

/** Other recent posts for the "More articles" block under an article. */
export async function relatedPosts(excludeId: number, category: string | null, take = 3): Promise<BlogPostSummary[]> {
  const same = category
    ? await db().blogPost.findMany({ where: { ...visible(), category, id: { not: excludeId } }, select: summarySelect, orderBy: { publishedAt: "desc" }, take })
    : [];
  if (same.length >= take) return same.map(toSummary);
  const more = await db().blogPost.findMany({
    where: { ...visible(), id: { notIn: [excludeId, ...same.map((s) => s.id)] } },
    select: summarySelect,
    orderBy: { publishedAt: "desc" },
    take: take - same.length,
  });
  return [...same, ...more].map(toSummary);
}
