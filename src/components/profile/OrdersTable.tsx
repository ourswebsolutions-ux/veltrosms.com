import Link from "next/link";
import { Money } from "@/components/currency/DisplayCurrency";
import { OrderStatus } from "@/components/orders/OrderStatus";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/Table";
import { formatPhone } from "@/lib/format";
import type { OrderListItem } from "@/types/account";
import { getT } from "@/i18n/server";
import { DateTime } from "@/components/ui/DateTime";

/** Orders as a table on ≥ md and as stacked cards on phones. */
export async function OrdersTable({ orders }: { orders: OrderListItem[] }) {
  const t = await getT();
  return (
    <>
      <Table className="hidden md:table">
        <THead>
          <tr>
            <Th>{t("order.order")}</Th>
            <Th>{t("common.service")}</Th>
            <Th className="hidden 2xl:table-cell">{t("common.country")}</Th>
            <Th>{t("common.number")}</Th>
            <Th>{t("common.code")}</Th>
            <Th>{t("common.status")}</Th>
            <Th className="text-end">{t("common.amount")}</Th>
          </tr>
        </THead>
        <TBody>
          {orders.map((o) => (
            <Tr key={o.id} className="hover:bg-surface-muted/60">
              <Td className="text-sm whitespace-nowrap text-fg-muted">
                <DateTime iso={o.createdAt} short />
                <Link href={`/profile/orders/${o.id}`} className="block font-mono text-xs text-primary hover:underline" title={o.id}>
                  <bdi>#{o.id.slice(0, 8)}</bdi>
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
              <Td className="pe-0 text-end tabular-nums">
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
                <DateTime iso={o.createdAt} /> · <bdi className="font-mono">#{o.id.slice(0, 8)}</bdi>
              </span>
              {o.code && (
                <span className="text-sm font-semibold text-success">
                  {t("common.code")} <bdi className="font-mono">{o.code}</bdi>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
