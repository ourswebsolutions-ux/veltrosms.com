import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.signup"), robots: { index: false } };
}

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/profile");
  const t = await getT();
  return (
    <AuthShell title={t("nav.signup")} description={t("auth.registerIntro")} switchLink={{ prompt: t("auth.haveAccount"), label: t("nav.login"), href: "/login" }}>
      <RegisterForm />
    </AuthShell>
  );
}
