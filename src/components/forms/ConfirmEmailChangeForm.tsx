"use client";

import { confirmEmailChangeAction } from "@/server/actions/settings";
import { FormMessage, SubmitButton } from "./FormParts";
import { useFormAction } from "./useFormAction";

export function ConfirmEmailChangeForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useFormAction(confirmEmailChangeAction);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-center font-medium break-all">{email}</p>
      <p className="text-sm text-fg-muted">After confirming, every device is logged out and you log in with this address.</p>
      <FormMessage state={state} />
      <SubmitButton block>Confirm new email</SubmitButton>
    </form>
  );
}
