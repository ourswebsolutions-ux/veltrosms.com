import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/profile/settings#password");
  return (
    <AuthShell
      title="Forgot password"
      description="Enter the email you signed up with and we'll send you a link to choose a new password."
      switchLink={{ prompt: "Remembered it?", label: "Log in", href: "/login" }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
