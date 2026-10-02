"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

/** Brand emblem (envelope with the VMG monogram), cut from public/logo.png. */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/mark.png" alt="" width={64} height={64} className={cn("object-contain", className)} aria-hidden="true" priority />;
}

/** Emblem + two-colour wordmark, as in the logo: "Virtu" navy, "MSG" gold. */
export function Logo({ className }: { className?: string }) {
  const t = useT();
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-1.5 text-fg sm:gap-2", className)} aria-label={t("nav.logoHome", { name: siteConfig.name })}>
      <LogoMark className="size-8 sm:size-9" />
      <span className="text-lg leading-none font-extrabold tracking-tight sm:text-[22px]">
        <span className="text-primary dark:text-fg">{siteConfig.shortName}</span>
        <span className="text-accent">{siteConfig.wordmarkAccent}</span>
      </span>
    </Link>
  );
}
