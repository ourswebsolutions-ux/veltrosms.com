import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResendVerificationForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { getT } from "@/i18n/server";
import { verifyEmail } from "@/server/services/auth.service";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.verifyTitle"), robots: { index: false } };
}

const PROBLEMS = { invalid: "auth.verifyInvalid", expired: "auth.verifyExpired", used: "auth.verifyUsed" } as const;

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const t = await getT();

  let problem: string | null = null;
  if (token) {
    const result = await verifyEmail(token);
    if (result.ok) redirect("/login?verified=1");
    problem = t(PROBLEMS[result.reason]);
  }

  return (
    <AuthShell
      title={t("auth.verifyTitle")}
      description={t("auth.verifyIntro")}
      notice={problem && <Alert tone="error">{problem}</Alert>}
      switchLink={{ prompt: t("auth.alreadyConfirmed"), label: t("nav.login"), href: "/login" }}
    >
      <ResendVerificationForm />
    </AuthShell>
  );
}
