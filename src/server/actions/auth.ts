"use server";

import { redirect } from "next/navigation";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeNextPath,
} from "@/lib/validation/auth";
import { formatRetry } from "@/server/auth/rate-limit";
import { getRequestContext } from "@/server/auth/request";
import {
  clearSessionCookie,
  currentSessionToken,
  deleteSessionByToken,
  getCurrentUser,
  setSessionCookie,
} from "@/server/auth/session";
import * as auth from "@/server/services/auth.service";
import { logSecurityEvent } from "@/server/services/security-log";
import type { FormState } from "@/types/forms";

const GENERIC_ERROR: FormState = { status: "error", message: "Something went wrong. Please try again in a moment." };

/** Runs an action body, turning unexpected failures into a generic message. */
async function guarded(name: string, body: () => Promise<FormState>): Promise<FormState> {
  try {
    return await body();
  } catch (error) {
    console.error(`[auth] ${name} failed:`, error instanceof Error ? error.message : "unknown error");
    return GENERIC_ERROR;
  }
}

const str = (data: FormData, key: string) => {
  const v = data.get(key);
  return typeof v === "string" ? v : "";
};

const tooMany = (seconds: number): FormState => ({
  status: "error",
  code: "rate_limited",
  message: `Too many attempts. Please try again in ${formatRetry(seconds)}.`,
});

/* -------------------------------------------------------------- register -- */

export async function registerAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("register", async () => {
    const values = { name: str(data, "name"), email: str(data, "email") };
    const parsed = registerSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

    const { name, email, password } = parsed.data;
    const result = await auth.register({ name, email, password }, await getRequestContext());
    if (!result.ok) {
      if (result.code === "rate_limited") return { ...tooMany(result.retryAfterSeconds), values };
      return { status: "error", code: "email_taken", fieldErrors: { email: "An account with this email already exists. Log in instead." }, values };
    }
    // No email confirmation: the new account is signed in and goes straight to the dashboard.
    await setSessionCookie(result.session);
    return { status: "success", redirectTo: safeNextPath(str(data, "next")) };
  });
}

/* ----------------------------------------------------------------- login -- */

export async function loginAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("login", async () => {
    const values = { email: str(data, "email"), next: str(data, "next") };
    const parsed = loginSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

    const result = await auth.login(
      { email: parsed.data.email, password: parsed.data.password, remember: parsed.data.remember === "on" },
      await getRequestContext(),
    );
    if (result.ok) {
      await setSessionCookie(result.session);
      return { status: "success", redirectTo: safeNextPath(parsed.data.next) };
    }
    switch (result.code) {
      case "rate_limited":
        return { ...tooMany(result.retryAfterSeconds), values };
      case "suspended":
        return { status: "error", code: "suspended", values, message: "This account has been suspended. Please contact support." };
      default:
        // Deliberately identical for unknown email and wrong password.
        return { status: "error", code: "invalid", values, message: "Incorrect email or password." };
    }
  });
}

/* ---------------------------------------------------------------- logout -- */

export async function logoutAction(): Promise<void> {
  const token = await currentSessionToken();
  try {
    const user = await getCurrentUser();
    if (token) await deleteSessionByToken(token);
    if (user) await logSecurityEvent("logout", { userId: user.id });
  } catch (error) {
    console.error("[auth] logout cleanup failed:", error instanceof Error ? error.message : "unknown error");
  }
  await clearSessionCookie();
  redirect("/login?signedOut=1");
}

/* -------------------------------------------------------- password reset -- */

export async function forgotPasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("forgot-password", async () => {
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: { email: str(data, "email") } };
    const result = await auth.requestPasswordReset(parsed.data.email, await getRequestContext());
    if (!result.ok) return tooMany(result.retryAfterSeconds);
    return {
      status: "success",
      values: { email: parsed.data.email },
      message: "If an account exists for that email, we've sent a link to reset your password. It expires in 30 minutes.",
    };
  });
}

const TOKEN_MESSAGES = {
  invalid: "This reset link is invalid. Please request a new one.",
  expired: "This reset link has expired. Please request a new one.",
  used: "This reset link has already been used. Please request a new one.",
} as const;

export async function resetPasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("reset-password", async () => {
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      if (errors.token) return { status: "error", code: "invalid", message: TOKEN_MESSAGES.invalid };
      return { status: "error", fieldErrors: errors };
    }
    const result = await auth.resetPassword(parsed.data.token, parsed.data.password);
    if (!result.ok) return { status: "error", code: result.reason, message: TOKEN_MESSAGES[result.reason] };
    return { status: "success", message: "Your password has been changed. You can now log in with your new password." };
  });
}
