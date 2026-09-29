"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/icons";
import { Dropdown, dropdownItemClass } from "@/components/ui/Dropdown";
import { PageContainer } from "@/components/ui/PageContainer";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { accountNav } from "@/config/site";
import { cn } from "@/lib/cn";

/** `isAdmin` only decides whether the admin link is shown; access is enforced on the server. */
export type AccountBarUser = { name: string; email: string; balance: string; isAdmin?: boolean } | null;

/**
 * Orange bar under the header.
 *  - Desktop: profile section tabs on the left; auth buttons or balance +
 *    account menu on the right.
 *  - Mobile: one full-width "Profile  $0 ▾" pill that expands the same links.
 */
export function AccountBar({ user, guestBalance }: { user: AccountBarUser; guestBalance: string }) {
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
  const balance = user?.balance ?? guestBalance;

  return (
    <div className="bg-primary">
      {/* Desktop */}
      <PageContainer className="hidden h-[50px] items-center justify-between gap-4 lg:flex">
        <nav aria-label="Account" className="flex items-center gap-1">
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
              {item.label}
            </Link>
          ))}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile/top-up"
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary-soft pr-1 pl-3 text-sm font-semibold text-white tabular-nums hover:bg-white/25 focus-visible:outline-white"
              title="Add funds"
            >
              <Icon name="wallet" size={16} />
              {balance}
              <span className="flex size-6 items-center justify-center rounded bg-white text-primary" aria-hidden="true">
                <Icon name="plus" size={14} strokeWidth={2.6} />
              </span>
              <span className="sr-only">Add funds</span>
            </Link>
            <UserMenu name={user.name} email={user.email} isAdmin={Boolean(user.isAdmin)} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AuthLink href="/login">Log In</AuthLink>
            <AuthLink href="/register">Sign Up</AuthLink>
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
          <span className="flex size-6 items-center justify-center rounded-full border-2 border-white/70">
            <Icon name="user" size={14} strokeWidth={2.4} />
          </span>
          <span className="mr-auto">Profile</span>
          <span className="tabular-nums">{balance}</span>
          <Icon name="chevronDown" className={cn("transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div id={menuId} className="animate-pop mt-2 rounded-lg bg-surface p-1.5 shadow-pop">
            {user && (
              <p className="truncate px-3 py-2 text-sm text-fg-muted">
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
                {item.label}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link href="/admin" className="block rounded-md px-3 py-2.5 text-[15px] font-medium text-accent hover:bg-surface-muted">
                Admin panel
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
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="flex h-10 items-center justify-center rounded-lg bg-primary text-[15px] font-semibold text-white"
                >
                  Sign Up
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
  return (
    <Dropdown
      label="Account menu"
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
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-[13px] text-fg-muted">{email}</p>
      </div>
      <div className="pt-1">
        {isAdmin && (
          <Link href="/admin" data-close className={dropdownItemClass()}>
            <Icon name="shield" size={18} className="text-accent" /> Admin panel
          </Link>
        )}
        <Link href="/profile" data-close className={dropdownItemClass()}>
          <Icon name="phone" size={18} className="text-fg-muted" /> My numbers
        </Link>
        <Link href="/profile/top-up" data-close className={dropdownItemClass()}>
          <Icon name="plus" size={18} className="text-fg-muted" /> Add funds
        </Link>
        <Link href="/profile/history" data-close className={dropdownItemClass()}>
          <Icon name="wallet" size={18} className="text-fg-muted" /> Balance history
        </Link>
        <Link href="/profile/settings" data-close className={dropdownItemClass()}>
          <Icon name="settings" size={18} className="text-fg-muted" /> Settings
        </Link>
        <Link href="/profile/settings#api-key" data-close className={dropdownItemClass()}>
          <Icon name="key" size={18} className="text-fg-muted" /> API key
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
