"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { submitPartnerApplication } from "@/server/actions/forms";
import { initialFormState } from "@/types/forms";
import { FormMessage, PolicyConsent, SubmitButton } from "./FormParts";

export function PartnerForm({ kind }: { kind: "provider" | "software" }) {
  const [state, action] = useActionState(submitPartnerApplication, initialFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label="Messenger (Telegram, etc.)" error={e.messenger}>
          {(p) => <Input name="messenger" placeholder="Your preferred contact" {...p} />}
        </Field>
        <Field label="Your email for contact" required error={e.email}>
          {(p) => <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" {...p} />}
        </Field>
        <Field
          label={kind === "provider" ? "Countries of phone numbers" : "Services your software supports"}
          required
          error={e.countries}
        >
          {(p) => <Input name="countries" placeholder="Comma separated" {...p} />}
        </Field>
        <Field label="What else should we know?" error={e.details}>
          {(p) => <Input name="details" placeholder="Describe your business" {...p} />}
        </Field>
      </div>
      <div className="flex flex-col items-center gap-4">
        <PolicyConsent error={e.consent} />
        <FormMessage state={state} className="w-full max-w-md" />
        <SubmitButton size="lg" className="w-full max-w-[300px]">
          Send request
        </SubmitButton>
      </div>
    </form>
  );
}
