"use client";

import { ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { fieldErrors } from "@/lib/validation/auth";
import { adminRecoverySchema } from "@/lib/validation/recovery";
import { adminRecoveryAction } from "@/server/actions/recovery";
import { FormMessage, SubmitButton } from "./FormParts";
import { PasswordInput } from "./PasswordInput";
import { useFormAction } from "./useFormAction";

/** Emergency admin recovery (/hidden). Whether it may run is decided on the server only. */
export function AdminRecoveryForm() {
  const [state, action] = useFormAction(adminRecoveryAction, (data) => {
    const r = adminRecoverySchema.safeParse(Object.fromEntries(data));
    return r.success ? null : fieldErrors(r.error);
  });
  const e = state.fieldErrors ?? {};

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <ButtonLink href="/login">Log in</ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-4" autoComplete="off">
      <Field label="Recovery secret" required error={e.recoveryToken}>
        {(p) => <PasswordInput {...p} name="recoveryToken" autoComplete="off" required autoFocus />}
      </Field>
      <Field label="New admin email" required error={e.email}>
        {(p) => <Input {...p} name="email" type="email" inputMode="email" autoComplete="off" defaultValue={state.values?.email} required />}
      </Field>
      <Field label="New admin password" required error={e.password} hint="At least 10 characters, with letters and numbers.">
        {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required showStrength />}
      </Field>
      <Field label="Confirm password" required error={e.confirm}>
        {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Update admin</SubmitButton>
    </form>
  );
}
