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
import { formatShortDateTime } from "@/lib/format";
import { listUserSessions, requireUser } from "@/server/auth/session";
import { getAccountProfile } from "@/server/services/account.service";
import { pendingEmailChange } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Settings" };

/** Human-readable device label from a user agent (no parsing library needed). */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

export default async function SettingsPage() {
  const user = await requireUser("/profile/settings");
  const [profile, sessions, pendingEmail] = await Promise.all([
    getAccountProfile(user),
    listUserSessions(user.id, user.sessionId),
    pendingEmailChange(user.id),
  ]);

  return (
    <Card>
      <PageHeader
        title="Settings"
        description="Manage your profile, email, password, devices and preferences."
        actions={<LogoutButton />}
      />
      <SettingsSection id="profile" title="Profile" description="The name shown on your account.">
        <ProfileForm name={profile.name} />
      </SettingsSection>
      <SettingsSection id="email" title="Email" description="The address you log in with. A new address must be confirmed from its inbox.">
        <EmailForm email={profile.email} pending={pendingEmail} />
      </SettingsSection>
      <SettingsSection id="password" title="Password" description="Changing it logs you out on all other devices.">
        <PasswordForm />
      </SettingsSection>
      <SettingsSection id="security" title="Devices" description="Where you're currently logged in. Log out any device you don't recognise.">
        <SessionsPanel
          sessions={sessions.map((s) => ({
            id: s.id,
            current: s.current,
            device: describeDevice(s.userAgent),
            lastUsed: formatShortDateTime(s.lastUsedAt),
            signedIn: formatShortDateTime(s.createdAt),
          }))}
        />
      </SettingsSection>
      <SettingsSection id="preferences" title="Preferences" description="How the site looks and sounds on this device.">
        <PreferencesPanel />
      </SettingsSection>
      <SettingsSection id="api-key" title="API key" description="Authenticates your requests to the API. Keep it secret.">
        <ApiKeyPanel hint={profile.apiKeyHint} />
      </SettingsSection>
    </Card>
  );
}
