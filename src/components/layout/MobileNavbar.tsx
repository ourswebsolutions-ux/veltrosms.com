"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { isNavGroup, mainNav } from "@/config/site";
import { cn } from "@/lib/cn";
import { isActivePath } from "@/lib/nav";
import { HeaderIconButton, SoundToggle, ThemeToggle } from "./HeaderControls";
import { useT } from "@/i18n/client";

const links = [{ label: "common.home" as const, href: "/" }, ...mainNav.flatMap((item) => (isNavGroup(item) ? item.items : [item]))].filter(
  (l, i, all) => all.findIndex((x) => x.href === l.href) === i,
);

/**
 * Burger menu for < lg. Opens a panel under the header with the main links and
 * preferences. Account links live in the orange "Profile" pill (AccountBar).
 */
export function MobileNavbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const t = useT();

  // Close on navigation (state adjusted during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <HeaderIconButton
        label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        expanded={open}
        controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? "close" : "menu"} />
      </HeaderIconButton>
      {open && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-50 bg-black/30 sm:top-16" onClick={() => setOpen(false)}>
          <nav
            ref={panelRef}
            id={panelId}
            aria-label={t("nav.mobile")}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop max-h-full overflow-y-auto border-t border-line bg-surface px-3 pt-2 pb-5 shadow-pop"
          >
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {links.map((l) => {
                const active = isActivePath(pathname, l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-3 text-[17px] font-medium transition-colors",
                        active ? "bg-primary-tint text-primary" : "text-fg hover:bg-surface-muted",
                      )}
                    >
                      {t(l.label)}
                      <Icon name="chevronRight" size={18} className="text-fg-subtle" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center gap-2 border-t border-line px-3 pt-4">
              <span className="me-auto text-sm text-fg-muted">{t("nav.themeAndSound")}</span>
              <ThemeToggle />
              <SoundToggle />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
