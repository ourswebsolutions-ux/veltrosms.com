import type { Metadata } from "next";
import { LogoutButton } from "@/components/forms/LogoutButton";
import {
  ApiKeyPanel,
  EmailForm,
  PasswordForm,
  PreferencesPanel,
  ProfileForm,
  SessionsPanel,
  SettingsSection,
} from "@/components/profile/SettingsForms";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listUserSessions, requireUser } from "@/server/auth/session";
import { getAccountProfile } from "@/server/services/account.service";
import { pendingEmailChange } from "@/server/services/auth.service";
import { getT } from "@/i18n/server";
import type { Translator } from "@/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.settings") };
}

/** Human-readable device label from a user agent (no parsing library needed). */
function describeDevice(ua: string | null, t: Translator): string {
  if (!ua) return t("settings.unknownDevice");
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : t("settings.browser");
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : t("settings.unknownOs");
  return t("settings.deviceOn", { browser, os });
}

export default async function SettingsPage() {
  const user = await requireUser("/profile/settings");
  const [profile, sessions, pendingEmail] = await Promise.all([
    getAccountProfile(user),
    listUserSessions(user.id, user.sessionId),
    pendingEmailChange(user.id),
  ]);
  const t = await getT();

  return (
    <Card>
      <PageHeader
        title={t("nav.settings")}
        description={t("settings.intro")}
        actions={<LogoutButton />}
      />
      <SettingsSection id="profile" title={t("nav.profile")} description={t("settings.profileIntro")}>
        <ProfileForm name={profile.name} />
      </SettingsSection>
      <SettingsSection id="email" title={t("common.email")} description={t("settings.emailIntro")}>
        <EmailForm email={profile.email} pending={pendingEmail} />
      </SettingsSection>
      <SettingsSection id="password" title={t("common.password")} description={t("settings.passwordIntro")}>
        <PasswordForm />
      </SettingsSection>
      <SettingsSection id="security" title={t("settings.devices")} description={t("settings.devicesIntro")}>
        <SessionsPanel
          sessions={sessions.map((s) => ({
            id: s.id,
            current: s.current,
            device: describeDevice(s.userAgent, t),
            lastUsed: s.lastUsedAt,
            signedIn: s.createdAt,
          }))}
        />
      </SettingsSection>
      <SettingsSection id="preferences" title={t("settings.preferences")} description={t("settings.preferencesIntro")}>
        <PreferencesPanel />
      </SettingsSection>
      <SettingsSection id="api-key" title={t("nav.apiKey")} description={t("settings.apiKeyIntro")}>
        <ApiKeyPanel hint={profile.apiKeyHint} />
      </SettingsSection>
    </Card>
  );
}
