import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Wide promotional banner used on partner pages. The artwork is pure CSS so we
 * don't depend on stock illustrations.
 */
export function HeroBanner({
  children,
  icon,
  tone = "solid",
  className,
}: {
  children: ReactNode;
  icon: IconName;
  tone?: "solid" | "soft";
  className?: string;
}) {
  const solid = tone === "solid";
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)]",
        solid
          ? "bg-[linear-gradient(100deg,#0f3b6a_0%,#174b82_60%,#1f5a96_100%)] text-white"
          : "border border-primary bg-primary-tint text-fg",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] md:block">
        <span className={cn("absolute top-[12%] right-[18%] size-52 rounded-full", solid ? "bg-white/15" : "bg-primary/15")} />
        <span className={cn("absolute -top-10 right-[48%] size-24 rounded-full", solid ? "bg-white/10" : "bg-primary/10")} />
        <span className={cn("absolute right-[6%] -bottom-12 size-32 rounded-full", solid ? "bg-white/10" : "bg-primary/10")} />
        <span
          className={cn(
            "absolute top-1/2 right-[26%] flex size-32 -translate-y-1/2 rotate-6 items-center justify-center rounded-[32px] shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
            solid ? "bg-white text-primary" : "bg-primary text-white",
          )}
        >
          <Icon name={icon} size={64} strokeWidth={1.6} />
        </span>
      </div>
      <div className="relative p-6 sm:p-10 md:max-w-[62%]">{children}</div>
    </section>
  );
}

export function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface-muted p-6">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="mt-4 text-xl font-semibold text-primary">{title}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-fg">{children}</p>
    </div>
  );
}
