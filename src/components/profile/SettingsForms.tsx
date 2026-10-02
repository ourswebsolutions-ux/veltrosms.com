"use client";

import type { ReactNode } from "react";
import { FormMessage, SubmitButton } from "@/components/forms/FormParts";
import { PasswordInput } from "@/components/forms/PasswordInput";
import { useFormAction } from "@/components/forms/useFormAction";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Field, Input } from "@/components/ui/Input";
import { SegmentedTabs } from "@/components/ui/Tabs";
import { SOUND_KEY, usePref, useTheme, type Theme } from "@/lib/preferences";
import { changePasswordSchema, emailChangeSchema, fieldErrors, profileSchema } from "@/lib/validation/auth";
import {
  cancelEmailChangeAction,
  changePasswordAction,
  generateApiKey,
  requestEmailChangeAction,
  revokeApiKeyAction,
  revokeSessionAction,
  signOutOtherSessionsAction,
  updateProfileAction,
} from "@/server/actions/settings";
import { useT } from "@/i18n/client";
import { DateTime } from "@/components/ui/DateTime";

/** Two-column settings row: description on the left, form on the right. */
export function SettingsSection({
  id,
  title,
  description,
  badge,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="grid grid-cols-1 scroll-mt-36 gap-4 border-t border-line py-6 first:border-0 first:pt-0 last:pb-0 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div>
        <h2 id={id ? `${id}-title` : undefined} className="flex items-center gap-2 font-semibold">
          {title} {badge}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      </div>
      <div className="max-w-lg min-w-0">{children}</div>
    </section>
  );
}

const validate = (schema: typeof profileSchema | typeof changePasswordSchema | typeof emailChangeSchema) => (data: FormData) => {
  const r = schema.safeParse(Object.fromEntries(data));
  return r.success ? null : fieldErrors(r.error);
};

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useFormAction(updateProfileAction, validate(profileSchema));
  const e = state.fieldErrors ?? {};
  const t = useT();
  return (
    <form action={action} noValidate className="space-y-4">
      <Field label={t("common.name")} required error={e.name}>
        {(p) => <Input {...p} name="name" autoComplete="name" defaultValue={state.values?.name ?? name} required maxLength={100} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>{t("settings.saveChanges")}</SubmitButton>
    </form>
  );
}

/** Change the login email: confirmed from the new inbox before it takes effect. */
export function EmailForm({ email, pending }: { email: string; pending: string | null }) {
  const [state, action] = useFormAction(requestEmailChangeAction, validate(emailChangeSchema));
  const [cancelState, cancel] = useFormAction(cancelEmailChangeAction);
  const e = state.fieldErrors ?? {};
  const waiting = cancelState.status === "success" ? null : pending;
  const t = useT();
  return (
    <div className="space-y-4">
      <Field label={t("settings.currentEmail")}>{(p) => <Input {...p} type="email" value={email} readOnly className="text-fg-muted" />}</Field>
      {waiting && state.status !== "success" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary-tint-border bg-primary-tint px-3 py-2.5 text-sm">
          <Icon name="mail" size={18} className="text-primary" />
          <span className="min-w-0 flex-1">
            {t("settings.waitingFor")}{" "}
            <b className="break-all">
              <bdi>{waiting}</bdi>
            </b>
            . {t("settings.checkInbox")}
          </span>
          <form action={cancel}>
            <button type="submit" className="font-medium text-primary hover:underline">
              {t("common.cancel")}
            </button>
          </form>
        </div>
      )}
      <form action={action} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("settings.newEmail")} required error={e.email}>
            {(p) => <Input {...p} name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required />}
          </Field>
          <Field label={t("settings.currentPassword")} required error={e.password}>
            {(p) => <PasswordInput {...p} name="password" autoComplete="current-password" required />}
          </Field>
        </div>
        <FormMessage state={state.status === "idle" && cancelState.status !== "idle" ? cancelState : state} />
        <SubmitButton>{t("settings.changeEmail")}</SubmitButton>
      </form>
    </div>
  );
}

export function PasswordForm() {
  const [state, action] = useFormAction(changePasswordAction, validate(changePasswordSchema));
  const e = state.fieldErrors ?? {};
  const t = useT();
  return (
    <form action={action} noValidate className="space-y-4">
      <Field label={t("settings.currentPassword")} required error={e.current}>
        {(p) => <PasswordInput {...p} name="current" autoComplete="current-password" required />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("auth.newPassword")} required error={e.next} hint={t("settings.passwordHint")}>
          {(p) => <PasswordInput {...p} name="next" autoComplete="new-password" required showStrength />}
        </Field>
        <Field label={t("auth.repeatNewPassword")} required error={e.confirm}>
          {(p) => <PasswordInput {...p} name="confirm" autoComplete="new-password" required />}
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("settings.changePassword")}</SubmitButton>
    </form>
  );
}

export type SessionRow = { id: string; current: boolean; device: string; lastUsed: string; signedIn: string };

export function SessionsPanel({ sessions }: { sessions: SessionRow[] }) {
  const [state, action] = useFormAction(signOutOtherSessionsAction);
  const [revokeState, revoke] = useFormAction(revokeSessionAction);
  const others = sessions.filter((s) => !s.current).length;
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line p-4">
        <p className="font-medium">{t("settings.activeSessions")}</p>
        <ul className="mt-2 divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <Icon name="globe" size={20} className="shrink-0 text-fg-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{s.device}</p>
                <p className="text-xs text-fg-muted">
                  {t("settings.lastActive")} <DateTime iso={s.lastUsed} short /> · {t("settings.signedIn")} <DateTime iso={s.signedIn} short />
                </p>
              </div>
              {s.current ? (
                <Badge tone="success">{t("settings.thisDevice")}</Badge>
              ) : (
                <form action={revoke}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button type="submit" className="text-[13px] font-medium text-danger hover:underline">
                    {t("nav.logout")}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={action} className="mt-3 space-y-3">
          <FormMessage state={revokeState.status !== "idle" && state.status === "idle" ? revokeState : state} />
          {others > 0 && (
            <SubmitButton size="sm" className="bg-surface !text-primary ring-1 ring-primary hover:!bg-primary-tint">
              {others === 1 ? t("settings.logoutOne") : t("settings.logoutMany", { count: others })}
            </SubmitButton>
          )}
        </form>
      </div>
    </div>
  );
}

/** Per-browser preferences (stored on this device; nothing is sent to the server). */
export function PreferencesPanel() {
  const [theme, setTheme] = useTheme();
  const [sound, setSound] = usePref(SOUND_KEY);
  const t = useT();
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">{t("settings.theme")}</p>
        <SegmentedTabs<Theme>
          label={t("settings.theme")}
          value={theme ?? "light"}
          onChange={setTheme}
          items={[
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t("settings.sound")}</p>
        <SegmentedTabs<"on" | "off">
          label={t("settings.sound")}
          value={sound === "off" ? "off" : "on"}
          onChange={setSound}
          items={[
            { value: "on", label: t("settings.on") },
            { value: "off", label: t("settings.off") },
          ]}
        />
      </div>
      <p className="text-xs text-fg-muted">{t("settings.savedHere")}</p>
    </div>
  );
}

export function ApiKeyPanel({ hint }: { hint: string | null }) {
  const [state, action] = useFormAction(generateApiKey);
  const [revokeState, revoke] = useFormAction(revokeApiKeyAction);
  const fresh = state.status === "success" ? state.values?.apiKey : undefined;
  const current = revokeState.status === "success" ? null : fresh ? `${fresh.slice(0, 8)}…${fresh.slice(-4)}` : hint;
  const t = useT();

  return (
    <div className="space-y-4">
      {fresh ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.newKey")}</p>
          <div className="flex items-center gap-2 rounded-lg border border-primary-tint-border bg-primary-tint py-1 pe-1 ps-3">
            <code dir="ltr" className="min-w-0 flex-1 font-mono text-sm break-all">
              {fresh}
            </code>
            <CopyButton value={fresh} label={t("settings.copyKey")} showLabel />
          </div>
          <FormMessage state={state} />
        </div>
      ) : (
        <Field label={t("settings.yourKey")} hint={t("settings.keyHint")}>
          {(p) => <Input {...p} readOnly value={current ?? t("settings.notGenerated")} className="font-mono text-fg-muted" />}
        </Field>
      )}
      {!fresh && <FormMessage state={state.status === "error" ? state : revokeState} />}
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <SubmitButton>{current ? t("settings.generateNew") : t("settings.generate")}</SubmitButton>
        </form>
        {current && (
          <form action={revoke}>
            <SubmitButton className="!bg-surface-muted !text-danger hover:!bg-danger-tint">{t("settings.revoke")}</SubmitButton>
          </form>
        )}
      </div>
      {current && <p className="text-xs text-fg-muted">{t("settings.newKeyNote")}</p>}
    </div>
  );
}
