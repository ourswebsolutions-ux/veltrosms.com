"use server";

import { z } from "zod";
import { siteConfig } from "@/config/site";
import { getCurrentUser } from "@/server/auth/session";
import { db, isDatabaseConfigured } from "@/server/db";
import type { FormState } from "@/types/forms";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

const consent = z.literal("on", { error: "Please accept the privacy policy." });
const email = z.email({ error: "Enter a valid email address." }).max(320);

const notOpenYet = (what: string): FormState => ({
  status: "error",
  message: `${what} isn't available yet. Please email ${siteConfig.supportEmail} in the meantime.`,
});

/* -------------------------------------------------------------- feedback -- */

const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email,
  message: z.string().trim().min(10, "Message is too short.").max(5000),
  consent,
});

export async function submitFeedback(_prev: FormState, data: FormData): Promise<FormState> {
  const parsed = feedbackSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  // Delivery (support inbox / ticketing) is wired up in a later phase.
  return notOpenYet("Online feedback");
}

/* --------------------------------------------------- partner application -- */

const partnerSchema = z.object({
  messenger: z.string().trim().max(100).optional(),
  email,
  countries: z.string().trim().min(2, "List at least one country.").max(500),
  details: z.string().trim().max(2000).optional(),
  kind: z.enum(["provider", "software"]),
  consent,
});

export async function submitPartnerApplication(
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  const parsed = partnerSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!isDatabaseConfigured()) return notOpenYet("Online applications");

  const { email: contactEmail, messenger, countries, details, kind } = parsed.data;
  try {
    const user = await getCurrentUser();
    await db().partnerApplication.create({
      data: {
        kind: kind === "provider" ? "PROVIDER" : "SOFTWARE",
        userId: user?.id ?? null,
        contactEmail,
        contactMessenger: messenger || null,
        details: [`Countries/services: ${countries}`, details].filter(Boolean).join("\n\n"),
      },
    });
  } catch (error) {
    console.error("[partner] failed to save application:", error instanceof Error ? error.message : "unknown error");
    return { status: "error", message: "We couldn't save your request. Please try again." };
  }
  return {
    status: "success",
    message: "Thanks! We'll contact you within one business day.",
  };
}
