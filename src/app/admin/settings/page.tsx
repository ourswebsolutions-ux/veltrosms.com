import type { Metadata } from "next";
import { MaintenanceForm, ManualPaymentForm } from "@/components/admin/AdminForms";
import { KeyValues } from "@/components/admin/AdminParts";
import { SettingsSection } from "@/components/profile/SettingsForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { siteConfig } from "@/config/site";
import { adminSaveMaintenanceAction, adminSaveManualPaymentAction } from "@/server/actions/admin";
import { requireAdminPage } from "@/server/admin/guard";
import { getPlatformSettings } from "@/server/admin/platform";

export const metadata: Metadata = { title: "Settings" };

/** Only settings with real behaviour. Secrets stay in server environment variables. */
export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/settings");
  const s = await getPlatformSettings();

  return (
    <Card>
      <PageHeader title="Platform settings" />
      <SettingsSection id="maintenance" title="Maintenance mode" description="Pauses number purchases and top-ups for everyone and shows a banner. Browsing, login and this admin panel keep working.">
        <MaintenanceForm action={adminSaveMaintenanceAction} enabled={s.maintenance.enabled} message={s.maintenance.message} />
      </SettingsSection>
      <SettingsSection
        id="manual-payment"
        title="Manual payments"
        description="The Easypaisa / JazzCash account customers send money to, and the WhatsApp number for help. Shown on Add funds."
      >
        <ManualPaymentForm
          action={adminSaveManualPaymentAction}
          accountName={s.manual.accountName}
          accountNumber={s.manual.accountNumber}
          whatsapp={s.manual.whatsapp}
          note={s.manual.note}
        />
      </SettingsSection>
      <SettingsSection id="environment" title="Configuration" description="Set in the server environment (read-only here). Credentials are never shown.">
        <KeyValues
          rows={[
            ["Platform name", siteConfig.name],
            ["Currency", s.info.currency],
            ["Site URL", s.info.appUrl],
            ["SMS provider", s.info.smsProvider],
            ["Payment provider", s.info.paymentProvider],
            ["Email", s.info.email],
          ]}
        />
      </SettingsSection>
    </Card>
  );
}
