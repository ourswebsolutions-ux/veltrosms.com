"use client";

import { Icon } from "@/components/icons";
import { clearOrderStore } from "@/components/orders/order-store";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";
import { SubmitButton } from "./FormParts";
import { useT } from "@/i18n/client";

/**
 * Logout is a POST (server action), never a GET link, so it can't be
 * triggered cross-site or by link prefetching. Account data cached in the
 * page (live orders) is dropped as the form submits.
 */
export function LogoutButton({ className, variant = "button" }: { className?: string; variant?: "button" | "menu" }) {
  const t = useT();
  if (variant === "menu") {
    return (
      <form action={logoutAction} onSubmit={clearOrderStore}>
        <button
          type="submit"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm text-danger outline-none hover:bg-danger-tint focus-visible:bg-danger-tint",
            className,
          )}
        >
          <Icon name="logout" size={18} /> {t("nav.logout")}
        </button>
      </form>
    );
  }
  return (
    <form action={logoutAction} onSubmit={clearOrderStore} className={className}>
      <SubmitButton size="sm" className="!bg-surface-muted !text-fg hover:!bg-surface-sunken">
        {t("nav.logout")}
      </SubmitButton>
    </form>
  );
}
