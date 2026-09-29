"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { FormState } from "@/types/forms";

export function SubmitButton({
  children,
  className,
  size,
  block,
}: {
  children: string;
  className?: string;
  size?: ButtonSize;
  block?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} size={size} block={block} className={className}>
      {children}
    </Button>
  );
}

/** Form-level success/error banner. Field errors render next to their fields. */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (!state.message) return null;
  const ok = state.status === "success";
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        ok ? "bg-success-tint text-success" : "bg-danger-tint text-danger",
        className,
      )}
    >
      <Icon name={ok ? "checkCircle" : "alert"} size={18} className="mt-px shrink-0" />
      {state.message}
    </p>
  );
}

export function PolicyConsent({ error }: { error?: string }) {
  return (
    <div>
      <label className="inline-flex cursor-pointer items-start gap-2.5 text-[13px] text-fg-muted">
        <input
          type="checkbox"
          name="consent"
          className="mt-px size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
          aria-invalid={error ? true : undefined}
        />
        <span>
          I agree with the <span className="text-primary">privacy policy</span> and the processing
          of the data I submit.
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
