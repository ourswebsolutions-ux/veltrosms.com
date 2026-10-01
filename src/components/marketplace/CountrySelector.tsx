"use client";

import { useMemo } from "react";
import { CountryFlag } from "@/components/ui/CatalogVisuals";
import { Combobox } from "@/components/ui/Combobox";
import type { CountrySummary } from "@/types/catalog";
import { useT } from "@/i18n/client";

/** Searchable country picker with flags. */
export function CountrySelector({
  countries,
  value,
  onChange,
  className,
}: {
  countries: CountrySummary[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const t = useT();
  const options = useMemo(
    () =>
      countries.map((c) => ({
        value: c.id,
        label: c.name,
        icon: <CountryFlag iso2={c.iso2} size={24} />,
      })),
    [countries],
  );
  return (
    <Combobox
      label={t("common.country")}
      options={options}
      value={value}
      onChange={onChange}
      searchPlaceholder={t("market.searchCountries")}
      className={className}
    />
  );
}
