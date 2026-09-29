import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { safeNextPath } from "@/lib/validation/auth";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const next = one(sp.next) ? safeNextPath(one(sp.next)) : undefined;

  // Signed-in users don't need the login screen.
  if (await getCurrentUser()) redirect(next ?? "/profile");

  const notice = one(sp.verified) ? (
    <Alert tone="success" title="Email confirmed">
      Your account is active. Log in to continue.
    </Alert>
  ) : one(sp.emailChanged) ? (
    <Alert tone="success" title="Email changed">
      Log in with your new email address. All devices were logged out.
    </Alert>
  ) : one(sp.signedOut) ? (
    <Alert>You have been logged out.</Alert>
  ) : next ? (
    <Alert>Please log in to continue.</Alert>
  ) : null;

  return (
    <AuthShell
      title="Log in"
      notice={notice}
      switchLink={{ prompt: "New here?", label: "Create an account", href: "/register" }}
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
