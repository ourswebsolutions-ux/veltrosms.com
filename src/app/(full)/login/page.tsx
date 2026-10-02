import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { getT } from "@/i18n/server";
import { safeNextPath } from "@/lib/validation/auth";
import { getCurrentUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("nav.login"), robots: { index: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const next = one(sp.next) ? safeNextPath(one(sp.next)) : undefined;

  // Signed-in users don't need the login screen.
  if (await getCurrentUser()) redirect(next ?? "/profile");
  const t = await getT();

  const notice = one(sp.emailChanged) ? (
    <Alert tone="success" title={t("auth.emailChanged")}>
      {t("auth.emailChangedBody")}
    </Alert>
  ) : one(sp.signedOut) ? (
    <Alert>{t("auth.signedOut")}</Alert>
  ) : next ? (
    <Alert>{t("srv.auth.loginToContinue")}</Alert>
  ) : null;

  return (
    <AuthShell title={t("nav.login")} notice={notice} switchLink={{ prompt: t("auth.newHere"), label: t("auth.createAccount"), href: "/register" }}>
      <LoginForm next={next} />
    </AuthShell>
  );
}
