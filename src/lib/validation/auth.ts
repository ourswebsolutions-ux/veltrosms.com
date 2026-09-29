import { z } from "zod";

/**
 * Auth input rules shared by client (instant feedback) and server (the real
 * check). Keep this file free of server-only imports.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// A short list of passwords that pass naive rules but are trivially guessed.
const COMMON = new Set([
  "password123",
  "password1234",
  "qwerty12345",
  "qwertyuiop1",
  "1234567890a",
  "a1234567890",
  "iloveyou123",
  "welcome1234",
  "letmein1234",
  "admin12345",
  "abc1234567",
  "passw0rd123",
]);

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .min(1, "Enter your email address.")
  .max(254, "Email address is too long.")
  .pipe(z.email({ error: "Enter a valid email address." }))
  .transform(normalizeEmail);

export const nameSchema = z
  .string({ error: "Enter your name." })
  .trim()
  .min(1, "Enter your name.")
  .min(2, "Enter at least 2 characters.")
  .max(100, "Use at most 100 characters.")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u, "Use letters, spaces, apostrophes, dots or hyphens only.");

/** Returns a message describing the first unmet password rule, or null. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Include both letters and numbers.";
  if (/^(.)\1+$/.test(password)) return "Avoid repeating a single character.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "This password is too common.";
  // Parts of 4+ characters only, so short names don't reject ordinary words.
  const emailParts = (context.email?.split("@")[0] ?? "").toLowerCase().split(/[._+-]+/);
  if (emailParts.some((part) => part.length >= 4 && lower.includes(part))) return "Don't include your email in your password.";
  const nameParts = (context.name ?? "").toLowerCase().split(/[\s'.-]+/);
  if (nameParts.some((part) => part.length >= 4 && lower.includes(part))) return "Don't include your name in your password.";
  return null;
}

/** 0 (empty) … 4 (strong). Drives the strength meter only; rules are in passwordProblem. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) score++;
  if (passwordProblem(password)) score = Math.min(score, 1);
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: z.string().max(PASSWORD_MAX * 4),
    confirm: z.string(),
    consent: z.literal("on", { error: "Please accept the terms and privacy policy." }),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, { email: v.email, name: v.name });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX * 4),
  remember: z.literal("on").optional(),
  next: z.string().max(500).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().max(PASSWORD_MAX * 4),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX * 4),
    next: z.string().max(PASSWORD_MAX * 4),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.next);
    if (problem) ctx.addIssue({ code: "custom", path: ["next"], message: problem });
    else if (v.next === v.current) ctx.addIssue({ code: "custom", path: ["next"], message: "Choose a different password." });
    if (v.next !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export const profileSchema = z.object({ name: nameSchema });

export const emailChangeSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your current password.").max(PASSWORD_MAX * 4),
});

/** First error message per field, for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

/**
 * Only allow same-site relative redirects ("/profile", not "//evil.com" or
 * "https://…"), to prevent open redirects after login.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/profile"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
