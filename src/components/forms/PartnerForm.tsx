"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Input";
import { useT } from "@/i18n/client";
import { submitPartnerApplication } from "@/server/actions/forms";
import { initialFormState } from "@/types/forms";
import { FormMessage, PolicyConsent, SubmitButton } from "./FormParts";

export function PartnerForm({ kind }: { kind: "provider" | "software" }) {
  const [state, action] = useActionState(submitPartnerApplication, initialFormState);
  const e = state.fieldErrors ?? {};
  const t = useT();

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        <Field label={t("partner.messenger")} error={e.messenger}>
          {(p) => <Input name="messenger" placeholder={t("partner.messengerHint")} {...p} />}
        </Field>
        <Field label={t("partner.email")} required error={e.email}>
          {(p) => <Input name="email" type="email" autoComplete="email" placeholder="you@company.com" {...p} />}
        </Field>
        <Field label={kind === "provider" ? t("partner.countries") : t("partner.services")} required error={e.countries}>
          {(p) => <Input name="countries" placeholder={t("partner.commaSeparated")} {...p} />}
        </Field>
        <Field label={t("partner.details")} error={e.details}>
          {(p) => <Input name="details" placeholder={t("partner.detailsHint")} {...p} />}
        </Field>
      </div>
      <div className="flex flex-col items-center gap-4">
        <PolicyConsent error={e.consent} />
        <FormMessage state={state} className="w-full max-w-md" />
        <SubmitButton size="lg" className="w-full max-w-[300px]">
          {t("partner.send")}
        </SubmitButton>
      </div>
    </form>
  );
}
