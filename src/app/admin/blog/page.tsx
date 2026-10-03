import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/AdminForms";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminTable } from "@/components/admin/AdminTable";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { formatShortDateTime } from "@/lib/format";
import { adminBlogDeleteAction, adminBlogPublishAction } from "@/server/actions/admin";
import { listBlogPosts } from "@/server/admin/blog";
import { requireAdminPage } from "@/server/admin/guard";

export const metadata: Metadata = { title: "Blog" };

/** Blog articles: drafts and published posts. Only published posts (from their publication date) are public at /blog. */
export default async function AdminBlogPage({ searchParams }: PageProps<"/admin/blog">) {
  await requireAdminPage("/admin/blog");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = sp.status === "published" || sp.status === "draft" ? sp.status : undefined;
  const posts = await listBlogPosts({ q: q || undefined, status });

  return (
    <Card>
      <PageHeader
        title="Blog"
        description="Write articles for the public blog. Drafts stay private; published posts appear at /blog from their publication date."
        actions={<ButtonLink href="/admin/blog/new">+ New post</ButtonLink>}
      />
      <AdminFilters
        action="/admin/blog"
        active={Boolean(q || status)}
        fields={[
          { kind: "search", name: "q", placeholder: "Title, slug or category", value: q },
          {
            kind: "select",
            name: "status",
            label: "Status",
            value: status ?? "",
            options: [
              { value: "", label: "All" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Drafts" },
            ],
          },
        ]}
      />
      <AdminTable
        rows={posts}
        rowKey={(p) => String(p.id)}
        empty={<EmptyState compact icon="article" title={q || status ? "No posts match" : "No blog posts yet"} description="Create one with “New post”." />}
        columns={[
          {
            header: "Title",
            cell: (p) => (
              <Link href={`/admin/blog/${p.id}`} className="block max-w-md font-medium wrap-anywhere hover:text-primary">
                {p.title}
                <span className="block font-mono text-xs font-normal text-fg-muted">/blog/{p.slug}</span>
              </Link>
            ),
          },
          {
            header: "Status",
            cell: (p) =>
              !p.published ? (
                <Badge tone="neutral">Draft</Badge>
              ) : p.scheduled ? (
                <Badge tone="warning">Scheduled</Badge>
              ) : (
                <Badge tone="success">Published</Badge>
              ),
          },
          { header: "Category", cell: (p) => p.category ?? <span className="text-fg-muted">—</span> },
          { header: "Published", className: "whitespace-nowrap", cell: (p) => (p.publishedAt ? formatShortDateTime(p.publishedAt) : "—") },
          { header: "Created", className: "whitespace-nowrap text-fg-muted", desktopOnly: true, cell: (p) => formatShortDateTime(p.createdAt) },
          {
            header: "Actions",
            cell: (p) => (
              <span className="inline-flex flex-wrap justify-end gap-1.5">
                <Link
                  href={`/admin/blog/${p.id}`}
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold text-primary ring-1 ring-primary hover:bg-primary-tint"
                >
                  Edit
                </Link>
                {p.published && (
                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold text-primary ring-1 ring-primary hover:bg-primary-tint"
                  >
                    View
                  </Link>
                )}
                <ActionButton
                  action={adminBlogPublishAction}
                  fields={{ id: String(p.id), publish: String(!p.published) }}
                  label={p.published ? "Unpublish" : "Publish"}
                  tone={p.published ? "outline" : "primary"}
                  size="xs"
                />
                <ActionButton
                  action={adminBlogDeleteAction}
                  fields={{ id: String(p.id) }}
                  label="Delete"
                  tone="danger"
                  size="xs"
                  confirm={{ title: "Delete this blog post?", body: `“${p.title}” will be removed permanently, including its uploaded image. The deletion is audited.`, cta: "Delete post" }}
                />
              </span>
            ),
          },
        ]}
      />
    </Card>
  );
}
