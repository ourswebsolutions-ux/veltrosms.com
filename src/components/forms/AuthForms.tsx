"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Input";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/server/actions/auth";
import { useT } from "@/i18n/client";
import type { FormState } from "@/types/forms";
import { FormMessage, PolicyConsent, SubmitButton } from "./FormParts";
import { PasswordInput } from "./PasswordInput";
import { useFormAction } from "./useFormAction";

/** Client-side check with the same schema the server uses. */
function validateWith(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }) {
  return (data: FormData) => {
    const r = schema.safeParse(Object.fromEntries(data));
    return r.success ? null : fieldErrors(r.error as Parameters<typeof fieldErrors>[0]);
  };
}

/* ----------------------------------------------------------------- login -- */

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormAction(loginAction, validateWith(loginSchema));
  const e = state.fieldErrors ?? {};
  const email = state.values?.email ?? "";
  const t = useT();

  return (
    <div className="space-y-4">
      <form action={action} noValidate className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label={t("common.email")} required error={e.email}>
          {(p) => (
            <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" placeholder={t("common.email")} defaultValue={email} required autoFocus />
          )}
        </Field>
        <Field label={t("common.password")} required error={e.password}>
          {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" placeholder={t("common.password")} required />}
        </Field>
        <Checkbox name="remember" label={t("auth.remember")} />
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <SubmitButton>{t("nav.login")}</SubmitButton>
          <Link href="/forgot-password" className="text-[15px] text-primary hover:underline">
            {t("auth.forgotLink")}
          </Link>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------- register -- */

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useFormAction(registerAction, validateWith(registerSchema));
  const e = state.fieldErrors ?? {};
  const t = useT();

  return (
    <form action={action} noValidate className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label={t("common.name")} required error={e.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" placeholder={t("auth.yourName")} defaultValue={state.values?.name} required maxLength={100} autoFocus />}
      </Field>
      <Field label={t("common.email")} required error={e.email}>
        {(p) => (
          <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" placeholder={t("common.email")} defaultValue={state.values?.email} required />
        )}
      </Field>
      <Field label={t("common.password")} required error={e.password} hint={t("auth.passwordHint")}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" placeholder={t("common.password")} required showStrength />}
      </Field>
      <Field label={t("auth.repeatPassword")} required error={e.confirm}>
        {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" placeholder={t("auth.repeatPassword")} required />}
      </Field>
      <PolicyConsent error={e.consent} />
      <FormMessage state={state} />
      <SubmitButton>{t("auth.createAccountButton")}</SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------- password reset -- */

export function ForgotPasswordForm() {
  const [state, action] = useFormAction(forgotPasswordAction, validateWith(forgotPasswordSchema));
  const e = state.fieldErrors ?? {};
  const t = useT();
  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <p className="text-sm text-fg-muted">
          {t("auth.didntReceive")}{" "}
          {/* Full page load on purpose: it resets the form state. */}
          <a href="/forgot-password" className="text-primary hover:underline">
            {t("auth.tryAgain")}
          </a>
        </p>
      </div>
    );
  }
  return (
    <form action={action} noValidate className="space-y-4">
      <Field label={t("common.email")} required error={e.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" placeholder={t("common.email")} defaultValue={state.values?.email} required autoFocus />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("auth.sendResetLink")}</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormAction(resetPasswordAction, validateWith(resetPasswordSchema));
  const e = state.fieldErrors ?? {};
  const t = useT();

  if (state.status === "success") return <ResetDone state={state} />;
  if (state.code === "invalid" || state.code === "expired" || state.code === "used") {
    return <ResetLinkProblem message={t.server(state.message)} />;
  }

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t("auth.newPassword")} required error={e.password} hint={t("auth.passwordHint")}>
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required showStrength autoFocus />}
      </Field>
      <Field label={t("auth.repeatNewPassword")} required error={e.confirm}>
        {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("auth.setNewPassword")}</SubmitButton>
    </form>
  );
}

function ResetDone({ state }: { state: FormState }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <FormMessage state={state} />
      <ButtonLink href="/login">{t("nav.login")}</ButtonLink>
    </div>
  );
}

export function ResetLinkProblem({ message }: { message: string }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <Alert tone="error">{message}</Alert>
      <ButtonLink href="/forgot-password">{t("auth.requestNewLink")}</ButtonLink>
    </div>
  );
}
