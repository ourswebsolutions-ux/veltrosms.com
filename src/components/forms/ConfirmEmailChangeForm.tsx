"use client";

import { confirmEmailChangeAction } from "@/server/actions/settings";
import { FormMessage, SubmitButton } from "./FormParts";
import { useFormAction } from "./useFormAction";
import { useT } from "@/i18n/client";

export function ConfirmEmailChangeForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useFormAction(confirmEmailChangeAction);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p dir="ltr" className="rounded-lg bg-surface-muted px-4 py-3 text-center font-medium break-all">{email}</p>
      <p className="text-sm text-fg-muted">{t("auth.confirmNewNote")}</p>
      <FormMessage state={state} />
      <SubmitButton block>{t("auth.confirmNewTitle")}</SubmitButton>
    </form>
  );
}
