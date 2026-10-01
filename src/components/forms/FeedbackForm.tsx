"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { submitFeedback } from "@/server/actions/forms";
import { initialFormState } from "@/types/forms";
import { FormMessage, PolicyConsent, SubmitButton } from "./FormParts";
import { useT } from "@/i18n/client";

export function FeedbackForm() {
  const [state, action] = useActionState(submitFeedback, initialFormState);
  const e = state.fieldErrors ?? {};
  const t = useT();

  return (
    <Card className="border border-line bg-surface-muted! shadow-none!">
      <h2 className="mb-4 text-2xl font-semibold">{t("feedback.title")}</h2>
      <form action={action} noValidate className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <Field label={t("common.name")} required error={e.name}>
              {(p) => <Input name="name" autoComplete="name" className="bg-surface" {...p} />}
            </Field>
            <Field label={t("common.email")} required error={e.email}>
              {(p) => <Input name="email" type="email" autoComplete="email" className="bg-surface" {...p} />}
            </Field>
          </div>
          <Field label={t("feedback.message")} required error={e.message}>
            {(p) => <Textarea name="message" className="h-full min-h-32 bg-surface" {...p} />}
          </Field>
        </div>
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <SubmitButton className="min-w-28">{t("feedback.send")}</SubmitButton>
          <PolicyConsent error={e.consent} />
        </div>
      </form>
    </Card>
  );
}
