import type { Metadata } from "next";
import { headers } from "next/headers";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageContainer } from "@/components/ui/PageContainer";
import { ToastProvider } from "@/components/ui/Toast";
import { requireAdminPage } from "@/server/admin/guard";

export const metadata: Metadata = {
  title: { template: "%s | Admin", default: "Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell. Access is checked here and again in every page (layouts and
 * pages render independently); non-admins get a 404.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "/admin";
  const admin = await requireAdminPage(path.startsWith("/admin") ? path : "/admin");
  return (
    <PageContainer className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 py-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-6">
      <aside className="space-y-3 lg:sticky lg:top-[130px]">
        <div className="hidden rounded-lg bg-accent-tint px-3 py-2 text-xs lg:block">
          <p className="font-semibold text-accent">Administrator</p>
          <p className="truncate text-fg-muted">{admin.email}</p>
        </div>
        <AdminNav />
      </aside>
      <ToastProvider>
        <div className="min-w-0 space-y-4">{children}</div>
      </ToastProvider>
    </PageContainer>
  );
}
