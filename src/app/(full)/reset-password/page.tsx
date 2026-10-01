import type { Metadata } from "next";
import { ResetLinkProblem, ResetPasswordForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getT } from "@/i18n/server";
import { checkToken } from "@/server/services/auth.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.resetTitle"), robots: { index: false } };
}

const PROBLEMS = { invalid: "srv.auth.resetInvalid", expired: "srv.auth.resetExpired", used: "srv.auth.resetUsed" } as const;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  // Checked without consuming it; the token is only used when the form is submitted.
  const check = await checkToken(token, "PASSWORD_RESET");
  const t = await getT();

  return (
    <AuthShell title={t("auth.resetTitle")} switchLink={{ prompt: t("auth.remembered"), label: t("nav.login"), href: "/login" }}>
      {check.ok ? <ResetPasswordForm token={token} /> : <ResetLinkProblem message={t(PROBLEMS[check.reason])} />}
    </AuthShell>
  );
}
