"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Money } from "@/components/currency/DisplayCurrency";
import { PricePill } from "@/components/ui/Badge";
import { CountryFlag } from "@/components/ui/CatalogVisuals";
import { cn } from "@/lib/cn";
import { formatCount, formatPrice } from "@/lib/format";
import type { OfferGroup, PriceTier } from "@/types/catalog";
import { useT } from "@/i18n/client";

const VISIBLE_TIERS = 2;

/** One country in the sidebar list: headline price plus expandable price tiers. */
export function CountryOfferCard({
  group,
  favorite,
  onToggleFavorite,
  onSelect,
}: {
  group: OfferGroup;
  favorite: boolean;
  onToggleFavorite: () => void;
  onSelect: (tier: PriceTier) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const t = useT();
  const multi = group.tiers.length > 1;
  const headline = group.tiers[0];
  const tiers = showAll ? group.tiers : group.tiers.slice(0, VISIBLE_TIERS);

  return (
    <li className="rounded-xl border border-line bg-surface-muted/60">
      <div className="flex min-h-[50px] items-center gap-2.5 px-2 py-1.5 sm:px-2.5">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={favorite ? t("market.unstar", { country: group.country.name }) : t("market.star", { country: group.country.name })}
          className={cn("shrink-0 rounded p-0.5 transition-colors", favorite ? "text-primary" : "text-fg-subtle hover:text-primary")}
        >
          <Icon name="star" size={18} fill={favorite ? "currentColor" : "none"} strokeWidth={1.5} />
        </button>
        <CountryFlag iso2={group.country.iso2} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p dir="auto" className="truncate text-base font-medium text-fg rtl:text-right">
            {group.country.name}
          </p>
          {multi && (
            <p className="truncate text-[13px] text-fg-muted">
              {t("market.from")} <Money amount={group.minPrice} currency={group.currency} />
            </p>
          )}
        </div>
        <span className="text-[15px] whitespace-nowrap text-fg-muted tabular-nums">
          {t("common.qty", { count: formatCount(group.totalAvailable) })}
        </span>
        <button
          type="button"
          onClick={() => onSelect(headline)}
          aria-label={t("market.buyFor", { country: group.country.name, price: formatPrice(headline.price, group.currency) })}
        >
          <PricePill className="hover:bg-primary-hover">
            <Money amount={headline.price} currency={group.currency} />
          </PricePill>
        </button>
      </div>

      {multi && (
        <div className="border-t border-line px-2 pt-1.5 pb-1 sm:px-2.5">
          <div className="flex justify-between px-2 pb-1 text-xs text-fg-subtle">
            <span>{t("common.quantity")}</span>
            <span className="w-[68px]">{t("common.price")}</span>
          </div>
          <ul className="space-y-1.5">
            {tiers.map((tier, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(tier)}
                  className="flex h-11 w-full items-center justify-between rounded-lg bg-surface px-3 text-start text-[15px] text-fg-muted transition-colors hover:ring-1 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>{t("market.available", { count: formatCount(tier.available) })}</span>
                  <PricePill size="sm">
                    <Money amount={tier.price} currency={group.currency} />
                  </PricePill>
                </button>
              </li>
            ))}
          </ul>
          {group.tiers.length > VISIBLE_TIERS && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              aria-expanded={showAll}
              className="mx-auto flex items-center gap-1 py-2 text-[13px] font-medium text-primary"
            >
              {showAll ? t("market.fewerPrices") : t("market.allPricesCount", { count: group.tiers.length })}
              <Icon name="chevronDown" size={16} className={cn("text-fg-muted transition-transform", showAll && "rotate-180")} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
