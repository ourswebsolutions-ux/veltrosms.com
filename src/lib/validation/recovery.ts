import { z } from "zod";
import { emailSchema, PASSWORD_MAX, passwordProblem } from "./auth";

/**
 * Emergency admin recovery form (/hidden). Shared by client and server like
 * the auth schemas. The secret field is named "recoveryToken" so form helpers
 * treat it as a secret and never echo it back into the form.
 */
export const adminRecoverySchema = z
  .object({
    recoveryToken: z.string().min(1, "Enter the recovery secret.").max(512, "Enter the recovery secret."),
    email: emailSchema,
    password: z.string().max(PASSWORD_MAX * 4),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, { email: v.email });
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });
