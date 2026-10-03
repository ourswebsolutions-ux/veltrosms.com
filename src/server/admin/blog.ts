import "server-only";
import { db, isUniqueViolation } from "@/server/db";
import { deleteBlogImage } from "@/server/blog/images";
import type { AdminBlogRow } from "@/types/blog";
import { audit } from "./audit";
import type { AdminActor } from "./guard";
import type { AdminResult } from "./users";

/**
 * Blog management (Admin → Blog). Everything is validated here, on the
 * server; every change is audited. "Save draft" keeps a post private,
 * "Publish" makes it public from its publication date (now if none is given).
 */

export type BlogInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  /** "" = none, "/media/blog/…" (uploaded) or an http(s) image URL. */
  featuredImage: string;
  /** ISO date-time, or "" for none. */
  publishedAt: string;
  intent: "draft" | "publish";
};

const MAX_CONTENT = 200_000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "How to Receive SMS — 2026!" → "how-to-receive-sms-2026". */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/, "");
}

type Checked = { ok: false; message: string } | { ok: true; data: Omit<BlogInput, "intent" | "publishedAt" | "category" | "featuredImage"> & { category: string | null; featuredImage: string | null; publishedAt: Date | null; published: boolean } };

function check(input: BlogInput): Checked {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 200) return { ok: false, message: "Enter a title of 3–200 characters." };
  const slug = (input.slug.trim() ? input.slug.trim().toLowerCase() : slugify(title)).slice(0, 160);
  if (!SLUG_RE.test(slug)) return { ok: false, message: "The slug may contain only lowercase letters, digits and single hyphens, e.g. how-to-receive-sms." };
  const excerpt = input.excerpt.trim().replace(/\s+/g, " ");
  if (excerpt.length < 10 || excerpt.length > 500) return { ok: false, message: "Enter a short excerpt of 10–500 characters." };
  const content = input.content.replace(/\r\n/g, "\n").trim();
  if (content.length < 20) return { ok: false, message: "Write the article content (at least 20 characters)." };
  if (content.length > MAX_CONTENT) return { ok: false, message: "The article is too long (max 200,000 characters)." };
  const category = input.category.trim().replace(/\s+/g, " ");
  if (category.length > 60) return { ok: false, message: "Use a category of at most 60 characters." };
  const image = input.featuredImage.trim();
  if (image && !(/^\/media\/blog\/[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(image) || /^https?:\/\/[^\s"'<>]+$/i.test(image)) ) {
    return { ok: false, message: "The featured image must be an uploaded image or an http(s) image URL." };
  }
  if (image.length > 500) return { ok: false, message: "The image URL is too long." };
  let publishedAt: Date | null = null;
  if (input.publishedAt.trim()) {
    publishedAt = new Date(input.publishedAt.trim());
    if (Number.isNaN(publishedAt.getTime())) return { ok: false, message: "Enter a valid publication date." };
  }
  const published = input.intent === "publish";
  if (published && !publishedAt) publishedAt = new Date();
  return { ok: true, data: { title, slug, excerpt, content, category: category || null, featuredImage: image || null, publishedAt, published } };
}

const SLUG_TAKEN: AdminResult = { ok: false, message: "Another post already uses this slug. Choose a different one." };

const toRow = (p: { id: number; title: string; slug: string; category: string | null; published: boolean; publishedAt: Date | null; createdAt: Date; updatedAt: Date }): AdminBlogRow => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  category: p.category,
  published: p.published,
  scheduled: p.published && Boolean(p.publishedAt && p.publishedAt.getTime() > Date.now()),
  publishedAt: p.publishedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

export async function listBlogPosts(filter: { q?: string; status?: "published" | "draft" } = {}): Promise<AdminBlogRow[]> {
  const rows = await db().blogPost.findMany({
    where: {
      ...(filter.status ? { published: filter.status === "published" } : {}),
      ...(filter.q ? { OR: [{ title: { contains: filter.q } }, { slug: { contains: filter.q } }, { category: { contains: filter.q } }] } : {}),
    },
    select: { id: true, title: true, slug: true, category: true, published: true, publishedAt: true, createdAt: true, updatedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  return rows.map(toRow);
}

export async function getBlogPostForEdit(id: number) {
  return db().blogPost.findUnique({ where: { id } });
}

/** Existing category names, for the form's suggestions. */
export async function blogCategories(): Promise<string[]> {
  const rows = await db().blogPost.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
  return rows.map((r) => r.category!).filter(Boolean);
}

export async function createBlogPost(actor: AdminActor, input: BlogInput): Promise<AdminResult & { id?: number }> {
  const c = check(input);
  if (!c.ok) return c;
  try {
    const post = await db().blogPost.create({ data: c.data });
    await audit(actor, "blog.post_created", { type: "blog_post", id: String(post.id) }, true, { title: post.title, slug: post.slug, published: post.published }, `Created blog post "${post.title}"`);
    return { ok: true, id: post.id, message: post.published ? `Published "${post.title}".` : `Saved draft "${post.title}".` };
  } catch (error) {
    if (isUniqueViolation(error)) return SLUG_TAKEN;
    throw error;
  }
}

export async function updateBlogPost(actor: AdminActor, id: number, input: BlogInput): Promise<AdminResult> {
  const before = await db().blogPost.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "Post not found." };
  const c = check(input);
  if (!c.ok) return c;
  let after;
  try {
    after = await db().blogPost.update({ where: { id }, data: c.data });
  } catch (error) {
    if (isUniqueViolation(error)) return SLUG_TAKEN;
    throw error;
  }
  if (before.featuredImage !== after.featuredImage) await deleteBlogImage(before.featuredImage);
  const changed: string[] = (["title", "slug", "excerpt", "content", "category", "featuredImage", "published"] as const).filter((k) => before[k] !== after[k]);
  if (before.publishedAt?.getTime() !== after.publishedAt?.getTime()) changed.push("publishedAt");
  await audit(actor, "blog.post_updated", { type: "blog_post", id: String(id) }, true, { title: after.title, changed }, `Updated blog post "${after.title}"`);
  return { ok: true, message: after.published ? `Saved and published "${after.title}".` : `Saved draft "${after.title}".` };
}

export async function setBlogPostPublished(actor: AdminActor, id: number, published: boolean): Promise<AdminResult> {
  const post = await db().blogPost.findUnique({ where: { id }, select: { title: true, published: true, publishedAt: true } });
  if (!post) return { ok: false, message: "Post not found." };
  if (post.published === published) return { ok: true, message: `"${post.title}" is already ${published ? "published" : "a draft"}.` };
  await db().blogPost.update({ where: { id }, data: { published, ...(published && !post.publishedAt ? { publishedAt: new Date() } : {}) } });
  await audit(actor, published ? "blog.post_published" : "blog.post_unpublished", { type: "blog_post", id: String(id) }, true, { title: post.title }, `${published ? "Published" : "Unpublished"} blog post "${post.title}"`);
  return { ok: true, message: `${published ? "Published" : "Unpublished"} "${post.title}".` };
}

export async function deleteBlogPost(actor: AdminActor, id: number): Promise<AdminResult> {
  const post = await db().blogPost.findUnique({ where: { id }, select: { title: true, slug: true, featuredImage: true, published: true } });
  if (!post) return { ok: false, message: "Post not found." };
  await db().blogPost.delete({ where: { id } });
  await deleteBlogImage(post.featuredImage);
  await audit(actor, "blog.post_deleted", { type: "blog_post", id: String(id) }, true, { title: post.title, slug: post.slug, wasPublished: post.published }, `Deleted blog post "${post.title}"`);
  return { ok: true, message: `Deleted "${post.title}".` };
}
