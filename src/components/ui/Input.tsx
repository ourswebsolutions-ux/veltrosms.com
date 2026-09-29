import type { ComponentProps, InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-line bg-surface-muted px-4 text-[15px] text-fg placeholder:text-fg-subtle transition-colors outline-none focus:border-primary focus:bg-surface disabled:opacity-60 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3", className)} {...props} />;
}

/** Search field with the square orange icon tile used across the marketplace. */
export function SearchInput({
  className,
  size = "md",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "sm" | "md" }) {
  return (
    <div className={cn("relative", className)}>
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 left-1.5 flex -translate-y-1/2 items-center justify-center rounded-md bg-primary text-white",
          size === "sm" ? "size-7" : "size-8",
        )}
      >
        <Icon name="search" size={size === "sm" ? 16 : 18} strokeWidth={2.2} />
      </span>
      <input
        type="search"
        className={cn(control, size === "sm" ? "h-10 pl-11 text-sm" : "h-11 pl-12")}
        {...props}
      />
    </div>
  );
}

/** Label + control + hint/error, wiring up ids for accessibility. */
export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm text-fg">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cn("flex w-fit cursor-pointer items-start gap-2.5 text-sm", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--color-primary)]"
        {...props}
      />
      <span className="text-fg-muted">{label}</span>
    </label>
  );
}
