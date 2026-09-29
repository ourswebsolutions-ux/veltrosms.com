"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { Dropdown } from "@/components/ui/Dropdown";
import { isNavGroup, mainNav } from "@/config/site";
import { cn } from "@/lib/cn";
import { isActivePath } from "@/lib/nav";

/** Desktop text navigation in the white header bar. */
export function Navbar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex xl:gap-2">
      {mainNav.map((item) =>
        isNavGroup(item) ? (
          <Dropdown
            key={item.label}
            label={`${item.label} menu`}
            panelClassName="w-72"
            trigger={({ open }) => (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-2 text-base font-medium text-fg transition-colors hover:text-primary xl:px-2.5 xl:text-[17px]",
                  item.items.some((i) => isActivePath(pathname, i.href)) && "text-primary",
                )}
              >
                {item.label}
                <Icon
                  name="caretDown"
                  size={16}
                  className={cn("text-primary transition-transform", open && "rotate-180")}
                />
              </span>
            )}
          >
            {item.items.map((sub) => (
              <Link
                key={sub.href + sub.label}
                href={sub.href}
                data-close
                className="block rounded-lg px-3 py-2.5 outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
              >
                <span className="block text-sm font-semibold text-fg">{sub.label}</span>
                {sub.description && (
                  <span className="block text-[13px] text-fg-muted">{sub.description}</span>
                )}
              </Link>
            ))}
          </Dropdown>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-2 py-2 text-base font-medium whitespace-nowrap text-fg transition-colors hover:text-primary xl:px-2.5 xl:text-[17px]",
              isActivePath(pathname, item.href) && "text-primary",
            )}
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
