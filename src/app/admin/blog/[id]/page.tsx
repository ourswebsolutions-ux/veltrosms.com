import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminBlogUpdateAction } from "@/server/actions/admin";
import { blogCategories, getBlogPostForEdit } from "@/server/admin/blog";
import { requireAdminPage } from "@/server/admin/guard";

export const metadata: Metadata = { title: "Edit blog post" };

export default async function EditBlogPostPage({ params }: PageProps<"/admin/blog/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/blog/${id}`);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const [post, categories] = await Promise.all([getBlogPostForEdit(n), blogCategories()]);
  if (!post) notFound();
  return (
    <Card>
      <Breadcrumbs items={[{ label: "Blog", href: "/admin/blog" }, { label: post.title }]} className="mb-3" />
      <PageHeader title="Edit blog post" description={post.published ? "This post is published. Changes go live when you save." : "This post is a draft and not visible to visitors."} />
      <BlogPostForm
        action={adminBlogUpdateAction}
        categories={categories}
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          category: post.category ?? "",
          featuredImage: post.featuredImage ?? "",
          publishedAt: post.publishedAt?.toISOString() ?? "",
          published: post.published,
        }}
      />
    </Card>
  );
}
