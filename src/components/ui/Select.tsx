import type { SelectHTMLAttributes } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/** Native select, styled. Use Dropdown/Combobox when options need rich content. */
export function Select({
  options,
  placeholder,
  className,
  ...props
}: { options: SelectOption[]; placeholder?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface-muted pe-10 ps-4 text-[15px] text-fg outline-none focus:border-primary"
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-primary"
      />
    </div>
  );
}
