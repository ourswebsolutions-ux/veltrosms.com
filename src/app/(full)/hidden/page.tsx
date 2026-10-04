import type { Metadata } from "next";
import { AdminRecoveryForm } from "@/components/forms/AdminRecoveryForm";
import { Card } from "@/components/ui/Card";
import { PageContainer } from "@/components/ui/PageContainer";

/**
 * Emergency admin recovery. Not linked anywhere and not indexed, but the URL
 * is not the protection: every change needs ADMIN_RECOVERY_SECRET, verified
 * on the server (src/server/admin/recovery.ts).
 */
export const metadata: Metadata = {
  title: "Admin recovery",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRecoveryPage() {
  return (
    <PageContainer size="form" className="space-y-5 pt-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Admin recovery</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-fg-muted">
          Enter the recovery secret and the new administrator email and password. All existing admin accounts and sessions will be revoked.
        </p>
      </div>
      <Card className="sm:!px-10 sm:!py-8">
        <div className="mx-auto max-w-[560px]">
          <AdminRecoveryForm />
        </div>
      </Card>
    </PageContainer>
  );
}
