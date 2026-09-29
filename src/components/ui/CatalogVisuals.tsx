import { cn } from "@/lib/cn";

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
 * Letter avatar for a service. We deliberately don't ship third-party logos;
 * swap this for licensed icons later if desired.
 */
export function ServiceAvatar({
  name,
  color,
  size = 28,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const light = isLight(color);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: color,
        color: light ? "#22252d" : "#fff",
      }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}
