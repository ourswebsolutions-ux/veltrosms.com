import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/forms/AuthForms";
import { AuthShell } from "@/components/layout/AuthShell";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign up", robots: { index: false } };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/profile");
  return (
    <AuthShell
      title="Sign up"
      description="Create a free account to get virtual numbers and receive SMS codes."
      switchLink={{ prompt: "Already have an account?", label: "Log in", href: "/login" }}
    >
      <RegisterForm />
    </AuthShell>
  );
}
