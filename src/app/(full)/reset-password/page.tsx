import type { Metadata } from "next";
import { ResetLinkProblem, ResetPasswordForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { checkToken } from "@/server/services/auth.service";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

const PROBLEMS = {
  invalid: "This reset link is invalid. Please request a new one.",
  expired: "This reset link has expired. Please request a new one.",
  used: "This reset link has already been used. Please request a new one.",
} as const;

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  // Checked without consuming it; the token is only used when the form is submitted.
  const check = await checkToken(token, "PASSWORD_RESET");

  return (
    <AuthShell title="Choose a new password" switchLink={{ prompt: "Remembered it?", label: "Log in", href: "/login" }}>
      {check.ok ? <ResetPasswordForm token={token} /> : <ResetLinkProblem message={PROBLEMS[check.reason]} />}
    </AuthShell>
  );
}
