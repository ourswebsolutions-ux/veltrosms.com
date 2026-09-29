import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type FilterField =
  | { kind: "search"; name: string; placeholder: string; value?: string }
  | { kind: "select"; name: string; label: string; value?: string; options: { value: string; label: string }[] }
  | { kind: "date"; name: string; label: string; value?: string }
  | { kind: "text"; name: string; label: string; placeholder?: string; value?: string }
  | { kind: "hidden"; name: string; value: string };

/** Plain GET filter form (shareable URLs, works without JavaScript). */
export function AdminFilters({ action, fields, active, extra }: { action: string; fields: FilterField[]; active: boolean; extra?: ReactNode }) {
  return (
    <form method="get" action={action} className="mb-4 flex flex-wrap items-end gap-2" aria-label="Filters">
      {fields.map((f) =>
        f.kind === "hidden" ? (
          <input key={f.name} type="hidden" name={f.name} value={f.value} />
        ) : f.kind === "search" ? (
          <label key={f.name} className="grid min-w-0 flex-1 basis-56 gap-1 text-xs text-fg-muted">
            Search
            <Input name={f.name} defaultValue={f.value ?? ""} placeholder={f.placeholder} className="h-9 min-w-0 px-3 text-sm" />
          </label>
        ) : f.kind === "text" ? (
          <label key={f.name} className="grid min-w-40 gap-1 text-xs text-fg-muted">
            {f.label}
            <Input name={f.name} defaultValue={f.value ?? ""} placeholder={f.placeholder} className="h-9 min-w-0 px-3 text-sm" />
          </label>
        ) : f.kind === "select" ? (
          <label key={f.name} className="grid min-w-36 gap-1 text-xs text-fg-muted">
            {f.label}
            <Select name={f.name} defaultValue={f.value ?? ""} options={f.options} className="[&_select]:h-9 [&_select]:text-sm" />
          </label>
        ) : (
          <label key={f.name} className="grid gap-1 text-xs text-fg-muted">
            {f.label}
            <Input type="date" name={f.name} defaultValue={f.value ?? ""} className="h-9 min-w-0 px-3 text-sm" />
          </label>
        ),
      )}
      <Button type="submit" size="sm" className="h-9">
        Apply
      </Button>
      {active && (
        <Link href={action} className="h-9 content-center px-1 text-sm text-primary hover:underline">
          Reset
        </Link>
      )}
      {extra}
    </form>
  );
}
