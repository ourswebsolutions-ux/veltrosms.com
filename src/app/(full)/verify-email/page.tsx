import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResendVerificationForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { verifyEmail } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

const PROBLEMS = {
  invalid: "This confirmation link is invalid. Request a new one below.",
  expired: "This confirmation link has expired. Request a new one below.",
  used: "This confirmation link has already been used. If your email is confirmed, just log in.",
} as const;

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;

  let problem: string | null = null;
  if (token) {
    const result = await verifyEmail(token);
    if (result.ok) redirect("/login?verified=1");
    problem = PROBLEMS[result.reason];
  }

  return (
    <AuthShell
      title="Confirm your email"
      description="We sent a confirmation link when you signed up. Enter your email to get a new one."
      notice={problem && <Alert tone="error">{problem}</Alert>}
      switchLink={{ prompt: "Already confirmed?", label: "Log in", href: "/login" }}
    >
      <ResendVerificationForm />
    </AuthShell>
  );
}
