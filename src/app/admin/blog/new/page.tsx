import type { Metadata } from "next";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { adminBlogCreateAction } from "@/server/actions/admin";
import { blogCategories } from "@/server/admin/blog";
import { requireAdminPage } from "@/server/admin/guard";

export const metadata: Metadata = { title: "New blog post" };

export default async function NewBlogPostPage() {
  await requireAdminPage("/admin/blog/new");
  const categories = await blogCategories();
  return (
    <Card>
      <Breadcrumbs items={[{ label: "Blog", href: "/admin/blog" }, { label: "New post" }]} className="mb-3" />
      <PageHeader title="New blog post" description="Save it as a draft while you work on it; Publish makes it public." />
      <BlogPostForm
        action={adminBlogCreateAction}
        categories={categories}
        initial={{ title: "", slug: "", excerpt: "", content: "", category: "", featuredImage: "", publishedAt: "", published: false }}
      />
    </Card>
  );
}
