import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.forgotTitle"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/profile/settings#password");
  const t = await getT();
  return (
    <AuthShell title={t("auth.forgotTitle")} description={t("auth.forgotIntro")} switchLink={{ prompt: t("auth.remembered"), label: t("nav.login"), href: "/login" }}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
