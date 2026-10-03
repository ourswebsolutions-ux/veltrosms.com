import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleContent } from "@/components/blog/ArticleContent";
import { BlogCard, BlogImage } from "@/components/blog/BlogCard";
import { Icon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { DateTime } from "@/components/ui/DateTime";
import { PageContainer } from "@/components/ui/PageContainer";
import { getT } from "@/i18n/server";
import { getPublishedPost, relatedPosts } from "@/server/services/blog.service";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: (await getT())("err.notFound") };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { type: "article", title: post.title, description: post.excerpt, publishedTime: post.publishedAt, ...(post.featuredImage ? { images: [post.featuredImage] } : {}) },
  };
}

/** One published article. Drafts, scheduled posts and unknown slugs are a 404. */
export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const [post, t] = await Promise.all([getPublishedPost(slug), getT()]);
  if (!post) notFound();
  const more = await relatedPosts(post.id, post.category);
  const minutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 200));

  return (
    <PageContainer size="form" className="space-y-6">
      <article className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card">
        <div className="p-4 sm:p-8">
          <Breadcrumbs items={[{ label: t("blog.title"), href: "/blog" }, { label: post.title }]} className="mb-4" />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
            {post.category && <span className="rounded-md bg-primary-tint px-2 py-0.5 font-semibold text-primary">{post.category}</span>}
            <DateTime iso={post.publishedAt} dateOnly />
            <span aria-hidden="true">·</span>
            <span>{t("blog.minRead", { n: minutes })}</span>
          </p>
          <h1 dir="auto" className="mt-3 text-[26px] leading-tight font-bold text-fg wrap-anywhere sm:text-4xl">
            {post.title}
          </h1>
          <p dir="auto" className="mt-3 text-lg leading-relaxed text-fg-muted wrap-anywhere">
            {post.excerpt}
          </p>
        </div>
        {post.featuredImage && <BlogImage src={post.featuredImage} priority className="aspect-[16/9] w-full" />}
        <div dir="auto" className="p-4 sm:p-8">
          <ArticleContent content={post.content} />
        </div>
      </article>

      <div className="flex justify-center">
        <ButtonLink href="/blog" variant="outline">
          <Icon name="chevronLeft" size={18} /> {t("blog.back")}
        </ButtonLink>
      </div>

      {more.length > 0 && (
        <section aria-labelledby="more-articles" className="space-y-3">
          <h2 id="more-articles" className="text-xl font-semibold">
            {t("blog.moreArticles")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <BlogCard key={p.id} post={p} t={t} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
