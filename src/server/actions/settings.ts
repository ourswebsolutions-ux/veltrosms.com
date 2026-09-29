"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changePasswordSchema, emailChangeSchema, fieldErrors, profileSchema } from "@/lib/validation/auth";
import { formatRetry } from "@/server/auth/rate-limit";
import { getRequestContext } from "@/server/auth/request";
import { clearSessionCookie, deleteUserSession, deleteUserSessions, getCurrentUser, setSessionCookie } from "@/server/auth/session";
import { createApiKey, revokeApiKey } from "@/server/services/api-key.service";
import * as auth from "@/server/services/auth.service";
import type { FormState } from "@/types/forms";

/**
 * Account settings. Every action re-checks the session server-side; the
 * settings page being protected is not enough on its own.
 */

const SIGNED_OUT: FormState = { status: "error", message: "Your session has ended. Please log in again.", redirectTo: "/login?next=%2Fprofile%2Fsettings" };
const GENERIC_ERROR: FormState = { status: "error", message: "Something went wrong. Please try again in a moment." };

async function guarded(name: string, body: () => Promise<FormState>): Promise<FormState> {
  try {
    return await body();
  } catch (error) {
    console.error(`[settings] ${name} failed:`, error instanceof Error ? error.message : "unknown error");
    return GENERIC_ERROR;
  }
}

export async function updateProfileAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("update-profile", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const parsed = profileSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values: { name: String(data.get("name") ?? "") } };
    await auth.updateProfile(user.id, parsed.data);
    revalidatePath("/profile", "layout");
    return { status: "success", message: "Profile saved.", values: { name: parsed.data.name } };
  });
}

export async function changePasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("change-password", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

    const result = await auth.changePassword(
      user,
      { current: parsed.data.current, next: parsed.data.next, persistent: await auth.isSessionPersistent(user.sessionId) },
      await getRequestContext(),
    );
    if (!result.ok) {
      if (result.code === "rate_limited") {
        return { status: "error", message: `Too many attempts. Please try again in ${formatRetry(result.retryAfterSeconds)}.` };
      }
      return { status: "error", fieldErrors: { current: "Your current password is incorrect." } };
    }
    // The old session was revoked with all others; continue on a fresh one.
    await setSessionCookie(result.session);
    revalidatePath("/profile/settings");
    return { status: "success", message: "Password changed. Other devices have been logged out." };
  });
}

export async function requestEmailChangeAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("request-email-change", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const values = { email: String(data.get("email") ?? "").slice(0, 254) };
    const parsed = emailChangeSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
    const result = await auth.requestEmailChange(user, { password: parsed.data.password, newEmail: parsed.data.email }, await getRequestContext());
    if (!result.ok) {
      if (result.code === "rate_limited") {
        return { status: "error", message: `Too many attempts. Please try again in ${formatRetry(result.retryAfterSeconds)}.`, values };
      }
      if (result.code === "same_email") return { status: "error", fieldErrors: { email: "This is already your email." }, values };
      return { status: "error", fieldErrors: { password: "Your current password is incorrect." }, values };
    }
    revalidatePath("/profile/settings");
    return {
      status: "success",
      message: `We sent a confirmation link to ${parsed.data.email}. Your email changes once you open it.`,
    };
  });
}

export async function cancelEmailChangeAction(_prev: FormState, _data: FormData): Promise<FormState> {
  return guarded("cancel-email-change", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    await auth.cancelEmailChange(user.id);
    revalidatePath("/profile/settings");
    return { status: "success", message: "Email change cancelled." };
  });
}

/** From the emailed link's confirm page. Works without a session (the link is the proof). */
export async function confirmEmailChangeAction(_prev: FormState, data: FormData): Promise<FormState> {
  const token = String(data.get("token") ?? "");
  let ok = false;
  const state = await guarded("confirm-email-change", async () => {
    const result = await auth.confirmEmailChange(token);
    if (result.ok) {
      ok = true;
      return { status: "success" };
    }
    const messages = {
      invalid: "This confirmation link is invalid.",
      expired: "This confirmation link has expired. Request the change again in Settings.",
      used: "This confirmation link has already been used.",
      taken: "That email address is no longer available. Request the change again with another address.",
    } as const;
    return { status: "error", message: messages[result.reason] };
  });
  if (!ok) return state;
  // Every session was revoked: log in again with the new address (full navigation).
  await clearSessionCookie();
  return { status: "success", redirectTo: "/login?emailChanged=1" };
}

export async function revokeSessionAction(_prev: FormState, data: FormData): Promise<FormState> {
  return guarded("revoke-session", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const id = z.uuid().safeParse(data.get("sessionId"));
    if (!id.success || id.data === user.sessionId) return { status: "error", message: "Choose another device to log out." };
    const removed = await deleteUserSession(user.id, id.data);
    revalidatePath("/profile/settings");
    return removed ? { status: "success", message: "That device has been logged out." } : { status: "error", message: "That session has already ended." };
  });
}

export async function signOutOtherSessionsAction(_prev: FormState, _data: FormData): Promise<FormState> {
  return guarded("sign-out-others", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const count = await deleteUserSessions(user.id, { except: user.sessionId });
    revalidatePath("/profile/settings");
    return {
      status: "success",
      message: count ? `Logged out of ${count} other ${count === 1 ? "session" : "sessions"}.` : "No other sessions were active.",
    };
  });
}

export async function generateApiKey(_prev: FormState, _data: FormData): Promise<FormState> {
  return guarded("generate-api-key", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    const { key } = await createApiKey(user.id);
    revalidatePath("/profile/settings");
    // The only time the full key is ever returned.
    return { status: "success", message: "Copy your new API key now — it won't be shown again.", values: { apiKey: key } };
  });
}

export async function revokeApiKeyAction(_prev: FormState, _data: FormData): Promise<FormState> {
  return guarded("revoke-api-key", async () => {
    const user = await getCurrentUser();
    if (!user) return SIGNED_OUT;
    await revokeApiKey(user.id);
    revalidatePath("/profile/settings");
    return { status: "success", message: "API key revoked. Requests using it will be rejected." };
  });
}
