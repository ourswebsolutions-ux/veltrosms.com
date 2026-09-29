import type { Metadata } from "next";
import { ConfirmEmailChangeForm } from "@/components/forms/ConfirmEmailChangeForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { inspectEmailChange } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Confirm new email", robots: { index: false } };

const PROBLEMS = {
  invalid: "This confirmation link is invalid.",
  expired: "This confirmation link has expired. Request the change again in Settings.",
  used: "This confirmation link has already been used.",
} as const;

/**
 * Landing page for the email-change link. Opening it changes nothing (mail
 * scanners follow links); the change happens only when the button is pressed.
 */
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/confirm-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const check = await inspectEmailChange(token);

  return (
    <AuthShell
      title="Confirm new email"
      description={check.ok ? "Make this address the login email for your account." : undefined}
      notice={!check.ok && <Alert tone="error">{PROBLEMS[check.reason]}</Alert>}
    >
      {check.ok ? (
        <ConfirmEmailChangeForm token={token} email={check.newEmail} />
      ) : (
        <ButtonLink href="/profile/settings#profile" block>
          Go to settings
        </ButtonLink>
      )}
    </AuthShell>
  );
}
