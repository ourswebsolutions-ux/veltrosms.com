import mapping from "@/config/service-logos.json";

/**
 * Real logos for the most common services, keyed by the provider's service
 * code (stable, unlike display names). Files are generated into
 * /public/service-logos by `npm run logos:generate`. Any other service keeps
 * the letter avatar.
 */
const LOGOS: Record<string, { icon: string; brand: string }> = mapping;

/** Path of the service's logo, or null to use the letter avatar. */
export function serviceLogo(providerCode: string): string | null {
  const hit = LOGOS[providerCode];
  return hit ? `/service-logos/${hit.icon}.svg` : null;
}
