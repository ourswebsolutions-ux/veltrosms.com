import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

/** Brand emblem (envelope with the VMG monogram), cut from public/logo.png. */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/mark.png" alt="" width={64} height={64} className={cn("object-contain", className)} aria-hidden="true" priority />;
}

/** Emblem + two-colour wordmark, as in the logo: "Virtu" navy, "MSG" gold. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex shrink-0 items-center gap-2 text-fg", className)} aria-label={`${siteConfig.name} home`}>
      <LogoMark className="size-9" />
      <span className="text-[22px] leading-none font-extrabold tracking-tight">
        <span className="text-primary dark:text-fg">{siteConfig.shortName}</span>
        <span className="text-accent">{siteConfig.wordmarkAccent}</span>
      </span>
    </Link>
  );
}
