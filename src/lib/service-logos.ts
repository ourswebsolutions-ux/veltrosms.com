import mapping from "@/config/service-logos.json";
import { GENERIC_SERVICE_ICON } from "@/lib/generic-service-icon";

/**
 * The icon of every catalog service, keyed by the provider's service code
 * (stable, unlike display names): the official brand logo when there is one,
 * otherwise a category badge (bank, betting, shopping…), otherwise the
 * neutral app badge. Built by `npm run logos:map`; the SVG files in
 * /public/service-logos come from `npm run logos:generate`.
 */
const LOGOS: Record<string, { icon: string; brand: string }> = mapping.logos;
const CATEGORIES: Record<string, string> = mapping.categories;

/** Path of the service's icon. Never empty: services not mapped yet (added by a sync since the last `logos:map`) get the neutral app badge. */
export function serviceLogo(providerCode: string): string {
  const logo = LOGOS[providerCode];
  if (logo) return `/service-logos/${logo.icon}.svg`;
  const category = CATEGORIES[providerCode];
  return category ? `/service-logos/category-${category}.svg` : GENERIC_SERVICE_ICON;
}
