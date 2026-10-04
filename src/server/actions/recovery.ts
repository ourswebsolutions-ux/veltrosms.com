"use server";

import { fieldErrors } from "@/lib/validation/auth";
import { adminRecoverySchema } from "@/lib/validation/recovery";
import { recoverAdmin } from "@/server/admin/recovery";
import { formatRetry } from "@/server/auth/rate-limit";
import { getRequestContext } from "@/server/auth/request";
import type { FormState } from "@/types/forms";

/**
 * Emergency admin recovery (/hidden). Authorization is the recovery secret,
 * verified on the server in recoverAdmin. The secret and passwords are never
 * logged or returned; only the email is echoed back to the form, and every
 * refusal gets the same message.
 */
export async function adminRecoveryAction(_prev: FormState, data: FormData): Promise<FormState> {
  const email = data.get("email");
  const values = { email: typeof email === "string" ? email : "" };
  try {
    const parsed = adminRecoverySchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

    const { recoveryToken, email: newEmail, password } = parsed.data;
    const result = await recoverAdmin({ secret: recoveryToken, email: newEmail, password }, await getRequestContext());
    if (result.ok) {
      return {
        status: "success",
        message: `${result.email} is now the only administrator. All previous admin accounts and sessions were revoked. Log in with the new email and password.`,
      };
    }
    if (result.code === "rate_limited") {
      return { status: "error", code: "rate_limited", values, message: `Too many attempts. Please try again in ${formatRetry(result.retryAfterSeconds)}.` };
    }
    return { status: "error", code: "denied", values, message: "Recovery failed. Check the details and try again." };
  } catch (error) {
    console.error("[recovery] admin recovery failed:", error instanceof Error ? error.message : "unknown error");
    return { status: "error", values, message: "Something went wrong. Please try again in a moment." };
  }
}
