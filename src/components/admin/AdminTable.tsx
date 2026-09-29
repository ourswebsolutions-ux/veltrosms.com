import type { ReactNode } from "react";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/cn";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hidden in the phone card layout (shown in the table only). */
  desktopOnly?: boolean;
};

/**
 * Dense data table on ≥ md; on phones every row becomes a labelled card,
 * so nothing needs horizontal scrolling.
 */
export function AdminTable<T>({ rows, columns, rowKey, empty }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; empty?: ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <>
      <Table className="hidden text-sm md:table">
        <THead>
          <tr>
            {columns.map((c) => (
              <Th key={c.header} className={c.className}>
                {c.header}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={rowKey(r)} className="hover:bg-surface-muted/60">
              {columns.map((c) => (
                <Td key={c.header} className={cn("py-2.5", c.className)}>
                  {c.cell(r)}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-xl border border-line p-3">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {columns
                .filter((c) => !c.desktopOnly)
                .map((c) => (
                  <div key={c.header} className="contents">
                    <dt className="text-fg-muted">{c.header}</dt>
                    <dd className="min-w-0 text-right break-words">{c.cell(r)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
