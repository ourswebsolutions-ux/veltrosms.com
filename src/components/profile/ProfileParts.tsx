import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";

export function StatCard({
  icon,
  label,
  value,
  hint,
  className,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-line bg-surface-muted/60 p-4", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-fg-muted">{label}</p>
        <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-fg-subtle">{hint}</p>}
      </div>
    </div>
  );
}
