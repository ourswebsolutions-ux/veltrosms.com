import Link from "next/link";
import { Icon } from "@/components/icons";
import { DateTime } from "@/components/ui/DateTime";
import { cn } from "@/lib/cn";
import type { Translator } from "@/i18n/translate";
import type { BlogPostSummary } from "@/types/blog";

/** Featured image, or a branded placeholder when the post has none. */
export function BlogImage({ src, className, priority }: { src: string | null; className?: string; priority?: boolean }) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-[radial-gradient(120%_140%_at_85%_20%,#1f5a96_0%,#0f3b6a_45%,#081f3a_100%)] text-white/80", className)} aria-hidden="true">
        <Icon name="article" size={40} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded files or admin-given URLs
    <img src={src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" className={cn("object-cover", className)} />
  );
}

/** Post card on /blog. `featured` = the large first card. */
export function BlogCard({ post, t, featured = false }: { post: BlogPostSummary; t: Translator; featured?: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card transition-shadow hover:shadow-pop",
        featured && "md:flex-row",
      )}
    >
      <BlogImage src={post.featuredImage} priority={featured} className={cn("aspect-[16/9] w-full", featured && "md:aspect-auto md:w-1/2 md:min-h-72")} />
      <div className={cn("flex min-w-0 flex-1 flex-col p-4 sm:p-5", featured && "md:p-8")}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted">
          {post.category && <span className="rounded-md bg-primary-tint px-2 py-0.5 font-semibold text-primary">{post.category}</span>}
          <DateTime iso={post.publishedAt} dateOnly />
        </p>
        <h2 dir="auto" className={cn("mt-2 font-semibold text-fg wrap-anywhere", featured ? "text-2xl sm:text-[28px] leading-tight" : "text-lg leading-snug")}>
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">
            {post.title}
          </Link>
        </h2>
        <p dir="auto" className={cn("mt-2 text-[15px] leading-relaxed text-fg-muted wrap-anywhere", featured ? "line-clamp-4" : "line-clamp-3")}>{post.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primary">
          {t("blog.readMore")} <Icon name="arrowRight" size={16} />
        </span>
      </div>
    </article>
  );
}
