import type { Metadata } from "next";
import { ConfirmEmailChangeForm } from "@/components/forms/ConfirmEmailChangeForm";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { getT } from "@/i18n/server";
import { inspectEmailChange } from "@/server/services/auth.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.confirmNewTitle"), robots: { index: false } };
}

const PROBLEMS = { invalid: "auth.confirmNewInvalid", expired: "auth.confirmNewExpired", used: "auth.confirmNewUsed" } as const;

/**
 * Landing page for the email-change link. Opening it changes nothing (mail
 * scanners follow links); the change happens only when the button is pressed.
 */
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/confirm-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const check = await inspectEmailChange(token);
  const t = await getT();

  return (
    <AuthShell
      title={t("auth.confirmNewTitle")}
      description={check.ok ? t("auth.confirmNewIntro") : undefined}
      notice={!check.ok && <Alert tone="error">{t(PROBLEMS[check.reason])}</Alert>}
    >
      {check.ok ? (
        <ConfirmEmailChangeForm token={token} email={check.newEmail} />
      ) : (
        <ButtonLink href="/profile/settings#profile" block>
          {t("auth.goToSettings")}
        </ButtonLink>
      )}
    </AuthShell>
  );
}
