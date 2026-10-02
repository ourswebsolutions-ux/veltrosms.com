import Image from "next/image";
import { cn } from "@/lib/cn";
import { GENERIC_SERVICE_ICON } from "@/lib/generic-service-icon";

/**
 * SVG country flag via the flag-icons stylesheet (imported once in the root
 * layout). Sized explicitly: the library's em-based sizing collapses inside
 * flex containers.
 */
export function CountryFlag({
  iso2,
  size = 18,
  className,
}: {
  iso2: string | null;
  /** Width in px; height follows the 4:3 flag ratio. */
  size?: number;
  className?: string;
}) {
  if (!iso2) {
    // Unknown region: neutral placeholder of the same size.
    return (
      <span
        className={cn("block shrink-0 rounded-[3px] bg-surface-sunken", className)}
        style={{ width: size, height: Math.round(size * 0.75) }}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn(
        `fi fi-${iso2.toLowerCase()} block shrink-0 rounded-[3px] bg-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]`,
        className,
      )}
      style={{ width: size, height: Math.round(size * 0.75) }}
      aria-hidden="true"
    />
  );
}

/**
 * Service icon: the brand logo, category badge or neutral app badge chosen
 * for the service code (src/lib/service-logos.ts) — never a letter. It is
 * decorative: the service name is always shown next to it.
 */
export function ServiceAvatar({
  logo,
  size = 28,
  className,
}: {
  /** Kept for callers; the icon comes from `logo`. */
  name?: string;
  color?: string;
  /** /service-logos/….svg; missing → the neutral app badge. */
  logo?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={logo || GENERIC_SERVICE_ICON}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      className={cn("block shrink-0 rounded-full object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
