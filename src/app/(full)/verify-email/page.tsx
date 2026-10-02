import { redirect } from "next/navigation";

/**
 * Signup no longer needs email confirmation (accounts can log in straight
 * away). Old confirmation links land on the login page.
 */
export default function VerifyEmailPage(): never {
  redirect("/login");
}
