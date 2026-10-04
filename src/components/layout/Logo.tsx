"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

/**
 * public/logo.png is a 500×500 canvas with the artwork in the middle. These
 * crops (in source pixels) trim the padding so the logo renders at its true
 * aspect ratio: the emblem alone, and the full emblem + wordmark lockup.
 */
const LOGO_SIZE = 500;
const MARK_CROP = { x: 53, y: 188, w: 123, h: 123 };
const LOCKUP_CROP = { x: 53, y: 196, w: 394, h: 106 };

function LogoCrop({ crop, className }: { crop: typeof MARK_CROP; className?: string }) {
  return (
    <span className={cn("block", className)} style={{ aspectRatio: `${crop.w} / ${crop.h}` }} aria-hidden="true">
      <span className="relative block size-full overflow-hidden">
        <Image
          src="/logo.png"
          alt=""
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          priority
          className="absolute h-auto max-w-none"
          style={{
            width: `${(LOGO_SIZE / crop.w) * 100}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
          }}
        />
      </span>
    </span>
  );
}

/** Brand emblem, cut from public/logo.png. */
export function LogoMark({ className }: { className?: string }) {
  return <LogoCrop crop={MARK_CROP} className={className} />;
}

/**
 * Full logo (emblem + wordmark) from public/logo.png. In dark mode, invert +
 * 180° hue-rotate flips lightness but keeps hue: the navy turns light, the gold stays gold.
 */
export function Logo({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link href="/" className={cn("flex shrink-0 items-center text-fg", className)} aria-label={t("nav.logoHome", { name: siteConfig.name })}>
      <LogoCrop crop={LOCKUP_CROP} className="h-8 sm:h-9 dark:invert dark:hue-rotate-180" />
    </Link>
  );
}
