import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

/** Borderless data table with hairline row dividers (matches the price table). */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className={cn("w-full border-collapse text-left text-[15px]", className)} {...props} />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-line last:border-b-0", className)} {...props} />;
}

export type SortDirection = "asc" | "desc" | null;

export function Th({
  className,
  children,
  sort,
  onSort,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  sort?: SortDirection;
  onSort?: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      {children}
      {onSort && (
        <Icon
          name="caretDown"
          size={14}
          className={cn(
            "transition-transform",
            sort ? "text-primary" : "text-fg-subtle",
            sort === "asc" && "rotate-180",
          )}
        />
      )}
    </>
  );
  return (
    <th
      scope="col"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
      className={cn("pb-2 text-[13px] font-normal whitespace-nowrap text-fg-muted", className)}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={cn("inline-flex items-center gap-0.5 hover:text-fg", sort && "text-fg")}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("py-2 pr-3 align-middle", className)} {...props} />;
}
