"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Money, useDisplayCurrency } from "@/components/currency/DisplayCurrency";
import { Icon } from "@/components/icons";
import { Dropdown, dropdownItemClass } from "@/components/ui/Dropdown";
import { PageContainer } from "@/components/ui/PageContainer";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { accountNav } from "@/config/site";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/client";

/** `isAdmin` only decides whether the admin link is shown; access is enforced on the server. */
export type AccountBarUser = { name: string; email: string; balance: number; currency: string; isAdmin?: boolean } | null;

/**
 * Orange bar under the header.
 *  - Desktop: profile section tabs on the left; auth buttons or balance +
 *    account menu on the right.
 *  - Mobile: one full-width "Profile  $0 ▾" pill that expands the same links.
 */
export function AccountBar({ user }: { user: AccountBarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // /profile is the "Received numbers" tab; it must not light up for sub-pages.
  const isActive = (href: string) => pathname === href;
  const { base } = useDisplayCurrency();
  const t = useT();
  // Wallet balance in the platform currency, with the approximate value in the chosen display currency.
  const balance = <Money amount={user?.balance ?? 0} currency={user?.currency ?? base} variant="both" approxClassName="text-white/75" />;

  return (
    <div className="bg-primary">
      {/* Desktop */}
      <PageContainer className="hidden h-[50px] items-center justify-between gap-4 lg:flex">
        <nav aria-label={t("nav.account")} className="flex items-center gap-1">
          {accountNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-white xl:text-sm",
                isActive(item.href)
                  ? "bg-white text-primary"
                  : "bg-primary-soft text-white hover:bg-white/25",
              )}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile/top-up"
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary-soft pe-1 ps-3 text-sm font-semibold text-white tabular-nums hover:bg-white/25 focus-visible:outline-white"
              title={t("nav.addFunds")}
            >
              <Icon name="wallet" size={16} />
              {balance}
              <span className="flex size-6 items-center justify-center rounded bg-white text-primary" aria-hidden="true">
                <Icon name="plus" size={14} strokeWidth={2.6} />
              </span>
              <span className="sr-only">{t("nav.addFunds")}</span>
            </Link>
            <UserMenu name={user.name} email={user.email} isAdmin={Boolean(user.isAdmin)} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AuthLink href="/login">{t("nav.loginButton")}</AuthLink>
            <AuthLink href="/register">{t("nav.signupButton")}</AuthLink>
          </div>
        )}
      </PageContainer>

      {/* Mobile */}
      <PageContainer className="py-2 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full items-center gap-2.5 rounded-lg bg-primary-soft px-3 text-base font-semibold text-white focus-visible:outline-white"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-white/70">
            <Icon name="user" size={14} strokeWidth={2.4} />
          </span>
          <span className="me-auto min-w-0 truncate text-start">{t("nav.profile")}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{balance}</span>
          <Icon name="chevronDown" className={cn("shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div
            id={menuId}
            className="animate-pop mt-2 max-h-[calc(100dvh-8.5rem)] overflow-y-auto overscroll-contain rounded-lg bg-surface p-1.5 shadow-pop"
          >
            {user && (
              <p className="px-3 py-2 text-sm text-fg-muted wrap-anywhere">
                <b className="font-semibold text-fg">{user.name}</b> · {user.email}
              </p>
            )}
            {accountNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-[15px] font-medium",
                  isActive(item.href) ? "bg-primary-tint text-primary" : "text-fg hover:bg-surface-muted",
                )}
              >
                {t(item.label)}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link href="/admin" className="block rounded-md px-3 py-2.5 text-[15px] font-medium text-accent hover:bg-surface-muted">
                {t("nav.adminPanel")}
              </Link>
            )}
            {user && (
              <div className="mt-1 border-t border-line pt-1">
                <LogoutButton variant="menu" />
              </div>
            )}
            {!user && (
              <div className="mt-1.5 grid grid-cols-2 gap-2 border-t border-line p-1.5 pt-3">
                <Link
                  href="/login"
                  className="flex h-10 items-center justify-center rounded-lg border border-primary text-[15px] font-semibold text-primary"
                >
                  {t("nav.loginButton")}
                </Link>
                <Link
                  href="/register"
                  className="flex h-10 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white"
                >
                  {t("nav.signupButton")}
                </Link>
              </div>
            )}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function UserMenu({ name, email, isAdmin }: { name: string; email: string; isAdmin: boolean }) {
  const t = useT();
  return (
    <Dropdown
      label={t("nav.accountMenu")}
      align="right"
      panelClassName="w-64"
      triggerClassName="focus-visible:outline-white"
      trigger={({ open }) => (
        <span className="flex h-8 max-w-56 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-semibold text-primary">
          <Icon name="user" size={16} />
          <span className="truncate">{name}</span>
          <Icon name="chevronDown" size={14} className={cn("transition-transform", open && "rotate-180")} />
        </span>
      )}
    >
      <div className="border-b border-line px-3 pt-1.5 pb-2.5">
        <p className="text-sm font-semibold wrap-anywhere">{name}</p>
        <p className="text-[13px] text-fg-muted wrap-anywhere">{email}</p>
      </div>
      <div className="pt-1">
        {isAdmin && (
          <Link href="/admin" data-close className={dropdownItemClass()}>
            <Icon name="shield" size={18} className="text-accent" /> {t("nav.adminPanel")}
          </Link>
        )}
        <Link href="/profile" data-close className={dropdownItemClass()}>
          <Icon name="phone" size={18} className="text-fg-muted" /> {t("nav.myNumbers")}
        </Link>
        <Link href="/profile/top-up" data-close className={dropdownItemClass()}>
          <Icon name="plus" size={18} className="text-fg-muted" /> {t("nav.addFunds")}
        </Link>
        <Link href="/profile/history" data-close className={dropdownItemClass()}>
          <Icon name="wallet" size={18} className="text-fg-muted" /> {t("nav.balanceHistory")}
        </Link>
        <Link href="/profile/settings" data-close className={dropdownItemClass()}>
          <Icon name="settings" size={18} className="text-fg-muted" /> {t("nav.settings")}
        </Link>
        <Link href="/profile/settings#api-key" data-close className={dropdownItemClass()}>
          <Icon name="key" size={18} className="text-fg-muted" /> {t("nav.apiKey")}
        </Link>
      </div>
      <div className="mt-1 border-t border-line pt-1">
        <LogoutButton variant="menu" />
      </div>
    </Dropdown>
  );
}

function AuthLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="flex h-8 items-center rounded-md bg-white px-3.5 text-[15px] font-medium text-primary transition-colors hover:bg-white/90 focus-visible:outline-white"
    >
      {children}
    </Link>
  );
}
