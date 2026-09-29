"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { PricePill } from "@/components/ui/Badge";
import { CountryFlag } from "@/components/ui/CatalogVisuals";
import { cn } from "@/lib/cn";
import { formatPrice, formatQty } from "@/lib/format";
import type { OfferGroup, PriceTier } from "@/types/catalog";

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
          aria-label={favorite ? `Unstar ${group.country.name}` : `Star ${group.country.name}`}
          className={cn(
            "shrink-0 rounded p-0.5 transition-colors",
            favorite ? "text-primary" : "text-fg-subtle hover:text-primary",
          )}
        >
          <Icon name="star" size={18} fill={favorite ? "currentColor" : "none"} strokeWidth={1.5} />
        </button>
        <CountryFlag iso2={group.country.iso2} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-base font-medium text-fg">{group.country.name}</p>
          {multi && (
            <p className="text-[13px] text-fg-muted">from {formatPrice(group.minPrice, group.currency)}</p>
          )}
        </div>
        <span className="text-[15px] whitespace-nowrap text-fg-muted tabular-nums">
          {formatQty(group.totalAvailable)}
        </span>
        <button type="button" onClick={() => onSelect(headline)} aria-label={`Buy ${group.country.name} number for ${formatPrice(headline.price, group.currency)}`}>
          <PricePill className="hover:bg-primary-hover">{formatPrice(headline.price, group.currency)}</PricePill>
        </button>
      </div>

      {multi && (
        <div className="border-t border-line px-2 pt-1.5 pb-1 sm:px-2.5">
          <div className="flex justify-between px-2 pb-1 text-xs text-fg-subtle">
            <span>Quantity</span>
            <span className="w-[68px]">Price</span>
          </div>
          <ul className="space-y-1.5">
            {tiers.map((tier, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onSelect(tier)}
                  className="flex h-11 w-full items-center justify-between rounded-lg bg-surface px-3 text-left text-[15px] text-fg-muted transition-colors hover:ring-1 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>Available {formatQty(tier.available)}</span>
                  <PricePill size="sm">{formatPrice(tier.price, group.currency)}</PricePill>
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
              {showAll ? "Fewer prices" : `All prices ${group.tiers.length}`}
              <Icon
                name="chevronDown"
                size={16}
                className={cn("text-fg-muted transition-transform", showAll && "rotate-180")}
              />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
