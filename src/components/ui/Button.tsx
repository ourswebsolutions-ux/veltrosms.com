import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "outline" | "soft" | "ghost" | "white" | "muted";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover/90 disabled:bg-primary/45",
  outline:
    "border border-primary text-primary bg-surface hover:bg-primary-tint active:bg-primary-selected disabled:opacity-50 disabled:hover:bg-surface",
  soft: "bg-primary-tint text-primary border border-primary-tint-border hover:border-primary active:bg-primary-selected disabled:opacity-50",
  ghost: "text-fg-muted hover:bg-surface-muted hover:text-fg active:bg-surface-sunken disabled:opacity-50",
  white: "bg-white text-primary hover:bg-white/90 active:bg-white/80",
  muted: "bg-surface-muted text-fg hover:bg-surface-sunken active:bg-line disabled:opacity-50",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1 rounded-md",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-5 text-[15px] gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed aria-disabled:pointer-events-none aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    block && "w-full",
    className,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function Button({
  variant,
  size,
  block,
  loading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, block, className })} {...props} />;
}
