"use client";

import { useRef, useState, type ReactNode } from "react";
import { FormMessage, SubmitButton } from "@/components/forms/FormParts";
import { useFormAction } from "@/components/forms/useFormAction";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResultToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { effectiveRate, formatConverted, type DisplayRates } from "@/lib/display-currency";
import { MONEY_SCALE, parseAmount } from "@/lib/money";
import type { FormState } from "@/types/forms";

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

function newKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const DANGER = "!bg-danger !text-white hover:!bg-danger/90";

/** Confirmation dialog shared by every destructive or financial admin action. */
function Confirm({
  open,
  title,
  children,
  cta,
  danger,
  disabled,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  cta: string;
  danger?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="muted" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={disabled} className={danger ? DANGER : undefined}>
            {cta}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[15px]">{children}</div>
    </Modal>
  );
}

/**
 * One admin action button (hidden fields + server action). With `confirm`,
 * a dialog must be accepted before the form is submitted. The outcome is
 * shown as a toast (and inline while the button is still on the page).
 */
export function ActionButton({
  action,
  fields,
  label,
  confirm,
  tone = "outline",
  size = "sm",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  confirm?: { title: string; body: string; cta?: string };
  tone?: "outline" | "primary" | "danger";
  size?: "xs" | "sm";
}) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const cls = cn(
    tone === "outline" && "!bg-surface !text-primary ring-1 ring-primary hover:!bg-primary-tint",
    tone === "danger" && "!bg-danger-tint !text-danger hover:!bg-danger hover:!text-white",
  );
  return (
    <div className="space-y-1.5">
      <form ref={formRef} action={run} className="inline-flex">
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {confirm ? (
          <Button type="button" size={size} variant={tone === "primary" ? "primary" : "outline"} className={cls} onClick={() => setAsking(true)}>
            {label}
          </Button>
        ) : (
          <SubmitButton size={size} className={cls}>
            {label}
          </SubmitButton>
        )}
      </form>
      {confirm && (
        <Confirm
          open={asking}
          title={confirm.title}
          cta={confirm.cta ?? label}
          danger={tone === "danger"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            formRef.current?.requestSubmit();
          }}
        >
          <p>{confirm.body}</p>
        </Confirm>
      )}
    </div>
  );
}

/** Suspend with a required reason (stored and shown to staff). */
export function SuspendUserButton({ action, userId, email }: { action: Action; userId: string; email: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action={run} className="hidden">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="reason" value={reason} />
      </form>
      <Button size="sm" variant="outline" className="!bg-danger-tint !text-danger !ring-0 hover:!bg-danger hover:!text-white" onClick={() => setOpen(true)}>
        Suspend account
      </Button>
      <Confirm
        open={open}
        title="Suspend this account?"
        cta="Suspend"
        danger
        disabled={reason.trim().length < 5}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p>
          <b>{email}</b> will be logged out everywhere and can&apos;t log in, buy numbers or use the API until re-activated. Their balance, orders
          and history are kept.
        </p>
        <Field label="Reason (recorded in the audit log)" required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Chargeback on top-up TP-…" />}
        </Field>
      </Confirm>
    </>
  );
}

/** Deletion with consequences spelled out and the email typed as confirmation. */
export function DeleteUserButton({ action, userId, email, balance }: { action: Action; userId: string; email: string; balance: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <form ref={formRef} action={run} className="hidden">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="confirmEmail" value={typed} />
      </form>
      <Button size="sm" variant="outline" className="!bg-surface !text-danger ring-1 !ring-danger hover:!bg-danger-tint" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Confirm
        open={open}
        title="Delete this account permanently?"
        cta="Delete account"
        danger
        disabled={typed.trim().toLowerCase() !== email}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      >
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>The user can never log in again and their name and email are erased.</li>
          <li>If the account has orders, payments or ledger entries, those records are kept (anonymized) for accounting.</li>
          <li>Refused while the balance isn&apos;t zero (currently {balance}), a top-up is pending, or a number is live.</li>
          <li>This can&apos;t be undone.</li>
        </ul>
        <Field label={`Type ${email} to confirm`} required>
          {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      </Confirm>
    </>
  );
}

export function EditUserForm({ action, userId, name, email }: { action: Action; userId: string; name: string; email: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  return (
    <form action={run} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          {(p) => <Input {...p} name="name" defaultValue={name} maxLength={100} />}
        </Field>
        <Field label="Email" required hint="Changing it logs the user out; they log in with the new address.">
          {(p) => <Input {...p} name="email" type="email" defaultValue={email} maxLength={254} />}
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="sm">Save changes</SubmitButton>
    </form>
  );
}

/**
 * Audited manual balance adjustment: add or deduct, amount, reason, then a
 * confirmation dialog showing the effect. One idempotency key per form.
 */
export function WalletAdjustForm({ action, userId, currency, balance, email }: { action: Action; userId: string; currency: string; balance: number; email: string }) {
  const [key, setKey] = useState(newKey);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run] = useFormAction(async (prev, data) => {
    const r = await action(prev, data);
    if (r.status === "success") {
      setKey(newKey()); // the next adjustment is a new operation
      setAmount("");
      setReason("");
    }
    return r;
  });
  useResultToast(state);
  const minor = amount.trim() ? parseAmount(amount.trim().replace(",", ".")) : null;
  const valid = minor !== null && minor > 0 && minor % (MONEY_SCALE / 100) === 0 && reason.trim().length >= 5;
  const after = minor !== null ? balance + (direction === "credit" ? minor : -minor) : balance;
  return (
    <form ref={formRef} action={run} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="confirm" value="on" />
      <div className="inline-flex rounded-lg border border-line p-1" role="radiogroup" aria-label="Adjustment type">
        {(["credit", "debit"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => setDirection(d)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium", direction === d ? (d === "credit" ? "bg-success text-white" : "bg-danger text-white") : "text-fg-muted hover:text-fg")}
          >
            {d === "credit" ? "Add balance" : "Deduct balance"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <Field label={`Amount (${currency})`} required error={state.fieldErrors?.amount}>
          {(p) => <Input {...p} name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="5.00" autoComplete="off" />}
        </Field>
        <Field label="Reason" required hint="Shown in the customer's history and the audit log" error={state.fieldErrors?.reason}>
          {(p) => <Input {...p} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. WhatsApp top-up, receipt #1042" />}
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="button" disabled={!valid} onClick={() => setAsking(true)}>
        Review adjustment
      </Button>
      <Confirm
        open={asking}
        title={direction === "credit" ? "Add balance?" : "Deduct balance?"}
        cta={direction === "credit" ? "Add balance" : "Deduct balance"}
        danger={direction === "debit"}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          formRef.current?.requestSubmit();
        }}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-fg-muted">Customer</dt>
          <dd className="font-medium">{email}</dd>
          <dt className="text-fg-muted">{direction === "credit" ? "Add" : "Deduct"}</dt>
          <dd className={cn("font-semibold tabular-nums", direction === "credit" ? "text-success" : "text-danger")}>{minor !== null ? formatPrice(minor, currency) : "—"}</dd>
          <dt className="text-fg-muted">Balance after</dt>
          <dd className="tabular-nums">{formatPrice(after, currency)}</dd>
          <dt className="text-fg-muted">Reason</dt>
          <dd>{reason}</dd>
        </dl>
        {after < 0 && <Alert tone="error">This would make the balance negative, so it will be refused.</Alert>}
        <p className="text-sm text-fg-muted">A permanent ledger entry and an audit record are created. It can only be reversed with another adjustment.</p>
      </Confirm>
    </form>
  );
}

export function ReviewForm({ action, paymentId }: { action: Action; paymentId: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  return (
    <form action={run} className="space-y-3">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Field label="Resolution note" required hint="What you checked and decided. Balance corrections are made separately as a wallet adjustment.">
        {(p) => <Textarea {...p} name="note" rows={3} maxLength={300} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Close review</SubmitButton>
    </form>
  );
}

export function PricingForm({ action, markupPercent, minMargin, currency }: { action: Action; markupPercent: string; minMargin: string; currency: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={run} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Markup (%)" hint="Added on top of the provider cost (0–500)">
          {(p) => <Input {...p} name="markupPercent" inputMode="decimal" defaultValue={markupPercent} />}
        </Field>
        <Field label={`Minimum margin (${currency})`} hint="Each price is at least cost + this">
          {(p) => <Input {...p} name="minMargin" inputMode="decimal" defaultValue={minMargin} />}
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="button" onClick={() => setAsking(true)}>
        Save and recalculate prices
      </Button>
      <Confirm
        open={asking}
        title="Change pricing?"
        cta="Save pricing"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p>Every customer price is recalculated from the stored provider costs. Orders already placed keep their price. The change is audited.</p>
      </Confirm>
    </form>
  );
}

export function MaintenanceForm({ action, enabled, message }: { action: Action; enabled: boolean; message: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={run} className="space-y-4">
      <Checkbox name="enabled" label="Maintenance mode (pause number purchases and top-ups)" defaultChecked={enabled} />
      <Field label="Message shown to customers" hint="Optional. Up to 300 characters.">
        {(p) => <Textarea {...p} name="message" rows={2} maxLength={300} defaultValue={message} />}
      </Field>
      {enabled && <Alert tone="warning">Maintenance mode is currently ON.</Alert>}
      <FormMessage state={state} />
      <Button type="button" onClick={() => setAsking(true)}>
        Save
      </Button>
      <Confirm
        open={asking}
        title="Save maintenance settings?"
        cta="Save"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p>While maintenance mode is on, customers can&apos;t buy numbers or submit top-ups. Browsing, login and the admin panel keep working.</p>
      </Confirm>
    </form>
  );
}

export function ManualPaymentForm({
  action,
  accountName,
  accountNumber,
  whatsapp,
  note,
}: {
  action: Action;
  accountName: string;
  accountNumber: string;
  whatsapp: string | null;
  note: string;
}) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={run} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Account name" required>
          {(p) => <Input {...p} name="accountName" defaultValue={accountName} maxLength={80} />}
        </Field>
        <Field label="Easypaisa / JazzCash number" required>
          {(p) => <Input {...p} name="accountNumber" inputMode="tel" defaultValue={accountNumber} maxLength={20} />}
        </Field>
      </div>
      <Field label="WhatsApp help number" hint="e.g. +923024966223 or 0302 4966223. Leave empty to hide WhatsApp help.">
        {(p) => <Input {...p} name="whatsapp" inputMode="tel" defaultValue={whatsapp ?? ""} maxLength={20} />}
      </Field>
      <Field label="Note for customers" hint="Optional, e.g. working hours.">
        {(p) => <Input {...p} name="note" maxLength={200} defaultValue={note} />}
      </Field>
      <FormMessage state={state} />
      <Button type="button" onClick={() => setAsking(true)}>
        Save payment details
      </Button>
      <Confirm
        open={asking}
        title="Change the payment account?"
        cta="Save payment details"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          formRef.current?.requestSubmit();
        }}
      >
        <p>Customers will immediately be told to send money to the account you entered. Double-check the name and number.</p>
      </Confirm>
    </form>
  );
}

/** Approve / reject a manual top-up (each behind a confirmation). */
export function TopUpReviewForms({ approve, reject, paymentId, summary }: { approve: Action; reject: Action; paymentId: string; summary: string }) {
  const [approveState, runApprove] = useFormAction(approve);
  const [rejectState, runReject] = useFormAction(reject);
  useResultToast(approveState);
  useResultToast(rejectState);
  const [asking, setAsking] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const approveRef = useRef<HTMLFormElement>(null);
  const rejectRef = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form ref={approveRef} action={runApprove}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <Button type="button" onClick={() => setAsking("approve")}>
            Approve &amp; credit wallet
          </Button>
        </form>
        <Button type="button" variant="outline" className="!text-danger !ring-danger" onClick={() => setAsking("reject")}>
          Reject
        </Button>
      </div>
      <FormMessage state={approveState.status !== "idle" ? approveState : rejectState} />
      <form ref={rejectRef} action={runReject} className="hidden">
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="reason" value={reason} />
      </form>
      <Confirm
        open={asking === "approve"}
        title="Approve payment?"
        cta="Approve"
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          setAsking(null);
          approveRef.current?.requestSubmit();
        }}
      >
        <p className="font-medium">Are you sure you want to approve this payment and credit the user&apos;s wallet?</p>
        <p>{summary}</p>
        <Alert tone="warning">Only approve after you have found this exact amount and transaction ID in the Easypaisa / JazzCash statement.</Alert>
      </Confirm>
      <Confirm
        open={asking === "reject"}
        title="Reject this top-up?"
        cta="Reject request"
        danger
        disabled={reason.trim().length < 5}
        onCancel={() => setAsking(null)}
        onConfirm={() => {
          setAsking(null);
          rejectRef.current?.requestSubmit();
        }}
      >
        <p>The customer sees this reason. Nothing is credited.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. No payment with this transaction ID was received." aria-label="Rejection reason" />
      </Confirm>
    </div>
  );
}

/**
 * Create or edit a Ready Made offer: service, country (or All countries),
 * admin-set price, available quantity and status. Every value is validated
 * again on the server.
 */
export function ReadyMadeOfferForm({
  action,
  services,
  countries,
  currency,
  initial,
  submitLabel,
}: {
  action: Action;
  services: { id: number; name: string }[];
  countries: { id: number; name: string }[];
  currency: string;
  initial: { id?: number; serviceId: number | null; countryId: number | null; price: string; availableQuantity: string; isActive: boolean };
  submitLabel: string;
}) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [serviceId, setServiceId] = useState(initial.serviceId ? String(initial.serviceId) : "");
  const [countryId, setCountryId] = useState(initial.countryId ? String(initial.countryId) : "all");
  const serviceOptions = services.map((s) => ({ value: String(s.id), label: s.name }));
  const countryOptions = [{ value: "all", label: "All countries" }, ...countries.map((c) => ({ value: String(c.id), label: c.name }))];
  return (
    <form action={run} className="space-y-4">
      {initial.id !== undefined && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="countryId" value={countryId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-fg">
            Service<span className="ms-0.5 text-primary">*</span>
          </span>
          <Combobox label="Service" options={serviceOptions} value={serviceId} onChange={setServiceId} placeholder="Choose a service" searchPlaceholder="Search services" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-fg">
            Country<span className="ms-0.5 text-primary">*</span>
          </span>
          <Combobox label="Country" options={countryOptions} value={countryId} onChange={setCountryId} searchPlaceholder="Search countries" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Price (${currency})`} required hint="What the customer pays for one Ready Made account. Independent of provider prices.">
          {(p) => <Input {...p} name="price" inputMode="decimal" placeholder="e.g. 2.50" defaultValue={initial.price} maxLength={20} required />}
        </Field>
        <Field
          label="Available quantity"
          required
          hint="Ready Made accounts you have in hand for this service and country. Each purchase takes one; at 0 customers see it as out of stock."
        >
          {(p) => (
            <Input {...p} name="availableQuantity" type="number" inputMode="numeric" min={0} max={100000} step={1} placeholder="e.g. 25" defaultValue={initial.availableQuantity} required />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-end pb-3">
          <Checkbox name="isActive" defaultChecked={initial.isActive} label="Active (offered to customers once Ready Made purchases are live)" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

/**
 * "+ Add Custom Margin" / "Edit": a service + country minimum margin that
 * replaces the global minimum margin for that pair. Opens a dialog; closes and
 * refreshes the list when saved. Everything is validated again on the server.
 */
export function CustomMarginDialog({
  action,
  services,
  countries,
  currency,
  globalMinMargin,
  initial,
  trigger,
}: {
  action: Action;
  services: { id: number; name: string }[];
  countries: { id: number; name: string }[];
  currency: string;
  globalMinMargin: string;
  initial?: { id: number; serviceId: number; countryId: number; minMargin: string };
  trigger: { label: string; size?: "xs" | "sm"; tone?: "primary" | "outline" };
}) {
  const [open, setOpen] = useState(false);
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [serviceId, setServiceId] = useState(initial ? String(initial.serviceId) : "");
  const [countryId, setCountryId] = useState(initial ? String(initial.countryId) : "");
  const formRef = useRef<HTMLFormElement>(null);
  // Close once a save succeeds (state adjusted during render, no effect needed).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "success") setOpen(false);
  }
  const serviceOptions = services.map((x) => ({ value: String(x.id), label: x.name }));
  const countryOptions = countries.map((x) => ({ value: String(x.id), label: x.name }));
  const outline = trigger.tone !== "primary";
  return (
    <>
      <Button
        type="button"
        size={trigger.size ?? "sm"}
        variant={outline ? "outline" : "primary"}
        className={outline ? "!bg-surface !text-primary ring-1 ring-primary hover:!bg-primary-tint" : undefined}
        onClick={() => setOpen(true)}
      >
        {trigger.label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={initial ? "Edit custom margin" : "Add custom margin"}
        footer={
          <>
            <Button variant="muted" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => formRef.current?.requestSubmit()}>Save</Button>
          </>
        }
      >
        <form ref={formRef} action={run} className="space-y-4">
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="countryId" value={countryId} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-fg">
              Service<span className="ms-0.5 text-primary">*</span>
            </span>
            <Combobox label="Service" options={serviceOptions} value={serviceId} onChange={setServiceId} placeholder="Choose a service" searchPlaceholder="Search services" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-fg">
              Country<span className="ms-0.5 text-primary">*</span>
            </span>
            <Combobox label="Country" options={countryOptions} value={countryId} onChange={setCountryId} placeholder="Choose a country" searchPlaceholder="Search countries" />
          </div>
          <Field
            label={`Minimum margin (${currency})`}
            required
            hint={`Replaces the global minimum margin (${globalMinMargin}) for this service in this country. The global markup still applies; the higher result wins.`}
          >
            {(p) => <Input {...p} name="minMargin" inputMode="decimal" placeholder="e.g. 0.30" defaultValue={initial?.minMargin ?? ""} maxLength={12} required />}
          </Field>
          <FormMessage state={state} />
        </form>
      </Modal>
    </>
  );
}

/**
 * Conversion tax / markup per display currency. It is ADDED TO THE EXCHANGE
 * RATE (1 USD = base + tax) and then used for every converted price on the
 * site — not added to a product price. Display only; charges stay in USD.
 */
/** Smallest top-up customers may request. Checked again on the server. */
export function TopUpMinimumForm({ action, minAmount, maxAmount, currency }: { action: Action; minAmount: string; maxAmount: string; currency: string }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  return (
    <form action={run} className="space-y-4">
      <Field label={`Minimum top-up (${currency})`} required hint={`Above 0 and up to ${maxAmount} ${currency}, at most 2 decimals. Applies to new top-up requests.`}>
        {(p) => <Input {...p} name="minAmount" inputMode="decimal" defaultValue={minAmount} maxLength={12} className="max-w-48 tabular-nums" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Save minimum</SubmitButton>
    </form>
  );
}

export function CurrencyMarkupForm({ action, rates, markup }: { action: Action; rates: DisplayRates; markup: Record<"PKR" | "INR" | "BDT", string> }) {
  const [state, run] = useFormAction(action);
  useResultToast(state);
  const [values, setValues] = useState(markup);
  const codes = ["PKR", "INR", "BDT"] as const;
  const num = (v: string) => {
    const n = Number(v.trim().replace(",", ".") || "0");
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const fmtRate = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return (
    <form action={run} className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="hidden grid-cols-[5rem_1fr_minmax(7rem,9rem)_1fr] gap-3 border-b border-line bg-surface-muted px-4 py-2 text-[13px] text-fg-muted sm:grid">
          <span>Currency</span>
          <span className="text-end">Base rate (1 {rates.base} =)</span>
          <span>Conversion tax</span>
          <span className="text-end">Effective rate</span>
        </div>
        {codes.map((code) => {
          const r = rates.rates[code];
          const tax = num(values[code]);
          const effective = r && tax !== null ? effectiveRate(r.baseRate, tax) : null;
          return (
            <div
              key={code}
              className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[5rem_1fr_minmax(7rem,9rem)_1fr]"
            >
              <span className="font-semibold">{code}</span>
              <span className="text-end text-sm tabular-nums sm:text-[15px]">
                <span className="text-fg-muted sm:hidden">Base: </span>
                {r ? fmtRate(r.baseRate) : <span className="text-fg-muted">No rate right now</span>}
                {r && <span className="block text-xs text-fg-muted">{r.source === "live" ? "live" : "fixed (server setting)"}</span>}
              </span>
              <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <span className="text-sm text-fg-muted sm:sr-only">Conversion tax ({code})</span>
                <Input
                  name={code}
                  value={values[code]}
                  onChange={(e) => setValues((v) => ({ ...v, [code]: e.target.value }))}
                  inputMode="decimal"
                  maxLength={12}
                  aria-label={`${code} conversion tax`}
                  aria-invalid={tax === null ? true : undefined}
                  className="h-10 min-w-0 flex-1 tabular-nums"
                />
              </label>
              <span className="col-span-2 text-sm tabular-nums sm:col-span-1 sm:text-end sm:text-[15px]">
                <span className="text-fg-muted sm:hidden">Effective: </span>
                {effective !== null ? (
                  <>
                    <b>{fmtRate(effective)}</b>
                    <span className="block text-xs text-fg-muted">$10 → {formatConverted(100_000, { currency: code, rate: effective })}</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] leading-relaxed text-fg-muted">
        Effective rate = base rate + conversion tax. Example: base 282 + tax 5 = 287, so $10 shows as Rs 2,870 (not Rs 2,825). It only changes the
        converted amounts customers see; prices, charges and balances stay in {rates.base}. Use 0 for no tax.
      </p>
      <FormMessage state={state} />
      <SubmitButton>Save conversion tax</SubmitButton>
    </form>
  );
}
