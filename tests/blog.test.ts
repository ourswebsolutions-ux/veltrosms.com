import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ArticleContent } from "@/components/blog/ArticleContent";
import { formatPhone, internationalPhone, stripBidi } from "@/lib/format";
import { createBlogPost, deleteBlogPost, listBlogPosts, setBlogPostPublished, slugify, updateBlogPost, type BlogInput } from "@/server/admin/blog";
import type { AdminActor } from "@/server/admin/guard";
import { readBlogImage, saveBlogImage } from "@/server/blog/images";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { getPublishedPost, listPublishedPosts } from "@/server/services/blog.service";
import { createUser, resetDatabase } from "./helpers";

async function admin(): Promise<AdminActor> {
  const u = await createUser();
  await db().user.update({ where: { id: u.id }, data: { role: "ADMIN" } });
  return { id: u.id, email: u.email, name: u.name, sessionId: "test" };
}

const post = (over: Partial<BlogInput> = {}): BlogInput => ({
  title: "How virtual numbers work",
  slug: "",
  excerpt: "A short introduction to receiving SMS codes online.",
  content: "## Intro\n\nVirtual numbers let you receive **codes** without your own SIM.",
  category: "Guides",
  featuredImage: "",
  publishedAt: "",
  intent: "draft",
  ...over,
});

let uploadDir: string;
beforeAll(() => {
  uploadDir = mkdtempSync(path.join(tmpdir(), "blog-uploads-"));
  process.env.BLOG_UPLOAD_DIR = uploadDir;
  resetEnvCache();
});
afterAll(async () => {
  rmSync(uploadDir, { recursive: true, force: true });
  await db().$disconnect();
});
beforeEach(() => resetDatabase());

describe("purchased number formatting", () => {
  it("shows and copies the same international number with its +", () => {
    expect(internationalPhone("923001234567")).toBe("+923001234567");
    expect(internationalPhone("+923001234567")).toBe("+923001234567");
    expect(internationalPhone(" 1 (234) 567-890 ")).toBe("+1234567890");
    // What the Copy button puts on the clipboard equals what is displayed.
    expect(stripBidi(formatPhone("923001234567"))).toBe(internationalPhone("923001234567"));
    expect(internationalPhone("not a number")).toBe("not a number");
  });
});

describe("blog (admin + public)", () => {
  it("drafts are private; publishing makes a post public; unpublishing hides it again", async () => {
    const a = await admin();
    const r = await createBlogPost(a, post());
    expect(r).toMatchObject({ ok: true });
    const slug = slugify("How virtual numbers work");
    expect(slug).toBe("how-virtual-numbers-work");
    expect(await getPublishedPost(slug)).toBeNull();
    expect((await listPublishedPosts()).posts).toHaveLength(0);

    const id = (await listBlogPosts())[0].id;
    expect(await setBlogPostPublished(a, id, true)).toMatchObject({ ok: true });
    const visible = await getPublishedPost(slug);
    expect(visible?.title).toBe("How virtual numbers work");
    expect((await listPublishedPosts()).categories).toEqual(["Guides"]);

    expect(await setBlogPostPublished(a, id, false)).toMatchObject({ ok: true });
    expect(await getPublishedPost(slug)).toBeNull();
  });

  it("a future publication date schedules the post", async () => {
    const a = await admin();
    await createBlogPost(a, post({ intent: "publish", slug: "later", publishedAt: new Date(Date.now() + 86_400_000).toISOString() }));
    expect(await getPublishedPost("later")).toBeNull();
    expect((await listBlogPosts())[0]).toMatchObject({ published: true, scheduled: true });
  });

  it("validates input and keeps slugs unique", async () => {
    const a = await admin();
    expect(await createBlogPost(a, post({ title: "x" }))).toMatchObject({ ok: false });
    expect(await createBlogPost(a, post({ slug: "Bad Slug!" }))).toMatchObject({ ok: false });
    expect(await createBlogPost(a, post({ excerpt: "short" }))).toMatchObject({ ok: false });
    expect(await createBlogPost(a, post({ featuredImage: "javascript:alert(1)" }))).toMatchObject({ ok: false });
    expect(await createBlogPost(a, post({ slug: "same" }))).toMatchObject({ ok: true });
    expect(await createBlogPost(a, post({ slug: "same" }))).toMatchObject({ ok: false, message: expect.stringMatching(/slug/) });
  });

  it("edits every field and deletes with an audit trail", async () => {
    const a = await admin();
    await createBlogPost(a, post({ slug: "first" }));
    const id = (await listBlogPosts())[0].id;
    expect(await updateBlogPost(a, id, post({ title: "Renamed post", slug: "renamed", category: "News", intent: "publish" }))).toMatchObject({ ok: true });
    expect((await getPublishedPost("renamed"))?.category).toBe("News");
    expect(await deleteBlogPost(a, id)).toMatchObject({ ok: true });
    expect(await db().blogPost.count()).toBe(0);
    const actions = (await db().auditLog.findMany({ orderBy: { id: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["blog.post_created", "blog.post_updated", "blog.post_deleted"]);
  });
});

describe("blog images", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082", "hex");

  it("stores real images under a random name and serves them back", async () => {
    const saved = await saveBlogImage(new File([png], "photo.png", { type: "image/png" }));
    expect(saved.ok && saved.url).toMatch(/^\/media\/blog\/[a-f0-9]{32}\.png$/);
    const name = saved.ok ? saved.url.split("/").pop()! : "";
    expect((await readBlogImage(name))?.type).toBe("image/png");
  });

  it("rejects non-images regardless of the claimed type, and odd names", async () => {
    expect(await saveBlogImage(new File(["<svg onload=alert(1)>"], "x.png", { type: "image/png" }))).toMatchObject({ ok: false });
    expect(await saveBlogImage(new File([Buffer.alloc(4 * 1024 * 1024, 0)], "big.png"))).toMatchObject({ ok: false });
    expect(await readBlogImage("../../etc/passwd")).toBeNull();
  });
});

describe("article rendering", () => {
  it("renders the Markdown subset and never passes HTML or unsafe links through", () => {
    const html = renderToStaticMarkup(
      createElement(ArticleContent, { content: "## Title\n\nHello **world** <script>alert(1)</script>\n\n- one\n- two\n\n[bad](javascript:alert(1)) [good](https://example.com)" }),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("<strong");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com"');
  });
});
