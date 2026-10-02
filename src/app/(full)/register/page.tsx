import { safeNextPath } from "@/lib/validation/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.signup"), robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/profile");
  const t = await getT();
  return (
    <AuthShell title={t("nav.signup")} description={t("auth.registerIntro")} switchLink={{ prompt: t("auth.haveAccount"), label: t("nav.login"), href: next ? `/login?next=${encodeURIComponent(next)}` : "/login" }}>
      <RegisterForm next={next} />
    </AuthShell>
  );
}
