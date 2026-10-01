"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";
import { Combobox } from "@/components/ui/Combobox";
import { EmptyState } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import type { ServiceSummary } from "@/types/catalog";
import { useT } from "@/i18n/client";

/**
 * Pick a service.
 *  - "grid": search field + tile grid of popular services (sidebar).
 *  - "select": searchable combobox (price table).
 */
export function ServiceSelector({
  services,
  value,
  onChange,
  variant = "grid",
  className,
}: {
  services: ServiceSummary[];
  value: string;
  onChange: (slug: string) => void;
  variant?: "grid" | "select";
  className?: string;
}) {
  const t = useT();
  const options = useMemo(
    () =>
      services.map((s) => ({
        value: s.slug,
        label: s.name,
        icon: <ServiceAvatar name={s.name} color={s.color} logo={s.logo} size={26} />,
      })),
    [services],
  );

  if (variant === "select") {
    return (
      <Combobox
        label={t("common.service")}
        options={options}
        value={value}
        onChange={onChange}
        searchPlaceholder={t("market.searchServices")}
        className={className}
      />
    );
  }
  return <ServiceGrid services={services} value={value} onChange={onChange} className={className} />;
}

function ServiceGrid({
  services,
  value,
  onChange,
  className,
}: {
  services: ServiceSummary[];
  value: string;
  onChange: (slug: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const t = useT();
  const q = query.trim().toLowerCase();
  const selected = services.find((s) => s.slug === value);
  const visible = q ? services.filter((s) => s.name.toLowerCase().includes(q)) : services.filter((s) => s.popular);

  return (
    <div className={className}>
      <label className="relative mb-2 flex h-12 items-center gap-2 rounded-lg border border-line bg-surface-muted pe-2 ps-2 focus-within:border-primary">
        {selected && !q ? (
          <ServiceAvatar name={selected.name} color={selected.color} logo={selected.logo} size={30} />
        ) : (
          <Icon name="search" size={22} className="mx-1 text-fg-subtle" />
        )}
        <span className="sr-only">{t("market.findService")}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected?.name ?? t("market.findService")}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
        />
        <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-[13px] font-semibold text-white">
          {t("market.searchCount", { count: services.length })}
        </span>
      </label>

      {visible.length === 0 ? (
        <EmptyState compact icon="search" title={t("market.noServices")} description={t("market.tryAnotherName")} />
      ) : (
        <ul className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3", q && "max-h-[312px] overflow-y-auto scroll-thin")}>
          {visible.map((s) => {
            const active = s.slug === value;
            return (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.slug);
                    setQuery("");
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex h-12 w-full items-center gap-2 rounded-lg border px-2 text-start text-base transition-colors",
                    active
                      ? "border-primary-tint-border bg-primary-selected font-medium text-fg"
                      : "border-line bg-surface-muted text-fg hover:border-primary-tint-border hover:bg-primary-tint",
                  )}
                >
                  <ServiceAvatar name={s.name} color={s.color} logo={s.logo} size={30} />
                  <span dir="auto" className="truncate rtl:text-right">
                    {s.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
