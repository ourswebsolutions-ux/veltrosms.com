import Link from "next/link";
import { CountryFlag, ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { formatPhone } from "@/lib/format";
import type { SmsHistoryItem } from "@/types/account";
import { DateTime } from "@/components/ui/DateTime";

/** Received SMS across the user's activations, each linked to its order. */
export function SmsHistoryList({ messages }: { messages: SmsHistoryItem[] }) {
  return (
    <ol className="space-y-2">
      {messages.map((m) => (
        <li key={m.id} className="rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ServiceAvatar name={m.service.name} color={m.service.color} logo={m.service.logo} size={26} />
            <div className="min-w-0 flex-1 leading-tight">
              <Link href={`/profile/orders/${m.orderId}`} className="font-medium hover:text-primary">
                {m.service.name}
              </Link>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-muted">
                <CountryFlag iso2={m.country.iso2} size={14} /> {m.country.name}
                {m.phoneNumber && <span className="font-mono">· {formatPhone(m.phoneNumber)}</span>}
              </p>
            </div>
            {m.code && <span className="rounded-md bg-success-tint px-2 py-0.5 font-mono text-[15px] font-bold text-success"><bdi>{m.code}</bdi></span>}
          </div>
          <p dir="auto" className="mt-2 text-[15px] break-words">
            {m.text}
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            {m.sender ? `${m.sender} · ` : ""}
            <DateTime iso={m.receivedAt} />
          </p>
        </li>
      ))}
    </ol>
  );
}
