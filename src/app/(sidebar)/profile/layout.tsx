import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { template: "%s | Profile", default: "Profile" },
  robots: { index: false },
};

/**
 * Server-side guard for every /profile/* route: validates the session in the
 * database and redirects to login otherwise. Pages call requireUser() as well,
 * because layouts and pages render independently.
 */
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const returnTo = (await headers()).get("x-pathname") ?? "/profile";
  await requireUser(returnTo.startsWith("/profile") ? returnTo : "/profile");
  return children;
}
