import Link from "next/link";
import { Money } from "@/components/currency/DisplayCurrency";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatDateTime, formatPhone, formatShortDateTime } from "@/lib/format";
import type { OrderListItem } from "@/types/account";

/** Orders as a table on ≥ md and as stacked cards on phones. */
export function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>Order</Th>
            <Th>Service</Th>
            <Th className="hidden 2xl:table-cell">Country</Th>
            <Th>Number</Th>
            <Th>Code</Th>
            <Th>Status</Th>
            <Th className="text-right">Amount</Th>
          </tr>
        </THead>
        <TBody>
          {orders.map((o) => (
            <Tr key={o.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap text-fg-muted">
                {formatShortDateTime(o.createdAt)}
                <Link href={`/profile/orders/${o.id}`} className="block font-mono text-xs text-primary hover:underline" title={`Order ${o.id}`}>
                  #{o.id.slice(0, 8)}
                </Link>
              </Td>
              <Td>
                <span className="flex items-center gap-2 font-medium">
                  <ServiceAvatar name={o.service.name} color={o.service.color} logo={o.service.logo} size={22} />
                  <span className="min-w-0">
                    <Link href={`/profile/orders/${o.id}`} className="block max-w-32 truncate hover:text-primary xl:max-w-40">
                      {o.service.name}
                    </Link>
                    <span className="flex items-center gap-1 text-xs font-normal text-fg-muted 2xl:hidden">
                      <CountryFlag iso2={o.country.iso2} size={12} /> {o.country.name}
                    </span>
                  </span>
                </span>
              </Td>
              <Td className="hidden 2xl:table-cell">
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <CountryFlag iso2={o.country.iso2} />
                  {o.country.name}
                </span>
              </Td>
              <Td className="font-mono text-[13px] whitespace-nowrap">{o.phoneNumber ? formatPhone(o.phoneNumber) : "—"}</Td>
              <Td className="font-mono font-semibold text-success">{o.code ?? <span className="text-fg-subtle">—</span>}</Td>
              <Td>
                <OrderStatus status={o.status} />
              </Td>
              <Td className="pr-0 text-right tabular-nums">
                <Money amount={o.price} currency={o.currency} variant="stack" className="items-end" />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <ul className="space-y-2 md:hidden">
        {orders.map((o) => (
          <li key={o.id} className="relative rounded-xl border border-line p-3 hover:border-primary-tint-border">
            <div className="flex items-center gap-2.5">
              <ServiceAvatar name={o.service.name} color={o.service.color} logo={o.service.logo} size={28} />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/orders/${o.id}`} className="block truncate font-medium after:absolute after:inset-0">
                  {o.service.name}
                </Link>
                <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                  <CountryFlag iso2={o.country.iso2} size={14} /> {o.country.name}
                </p>
              </div>
              <Money amount={o.price} currency={o.currency} variant="stack" className="items-end font-semibold tabular-nums" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <OrderStatus status={o.status} />
              <span className="font-mono text-fg-muted">{o.phoneNumber ? formatPhone(o.phoneNumber) : "—"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px] text-fg-muted">
              <span>
                {formatDateTime(o.createdAt)} · <span className="font-mono">#{o.id.slice(0, 8)}</span>
              </span>
              {o.code && <span className="font-mono text-sm font-semibold text-success">Code {o.code}</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
