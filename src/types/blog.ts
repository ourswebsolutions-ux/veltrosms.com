/** Blog DTOs shared by server and client. */

export type BlogPostSummary = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  /** /media/blog/<file> or an image URL; null = no image. */
  featuredImage: string | null;
  category: string | null;
  publishedAt: string;
};

export type BlogPostView = BlogPostSummary & { content: string; updatedAt: string };

export type AdminBlogRow = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  published: boolean;
  /** Published with a future publication date (not public yet). */
  scheduled: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
