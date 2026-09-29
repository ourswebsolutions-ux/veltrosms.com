"use client";

import { Icon } from "@/components/icons";
import { clearOrderStore } from "@/components/orders/order-store";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/cn";
import { SubmitButton } from "./FormParts";

/**
 * Logout is a POST (server action), never a GET link, so it can't be
 * triggered cross-site or by link prefetching. Account data cached in the
 * page (live orders) is dropped as the form submits.
 */
export function LogoutButton({ className, variant = "button" }: { className?: string; variant?: "button" | "menu" }) {
  if (variant === "menu") {
    return (
      <form action={logoutAction} onSubmit={clearOrderStore}>
        <button
          type="submit"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-danger outline-none hover:bg-danger-tint focus-visible:bg-danger-tint",
            className,
          )}
        >
          <Icon name="logout" size={18} /> Log out
        </button>
      </form>
    );
  }
  return (
    <form action={logoutAction} onSubmit={clearOrderStore} className={className}>
      <SubmitButton size="sm" className="!bg-surface-muted !text-fg hover:!bg-surface-sunken">
        Log out
      </SubmitButton>
    </form>
  );
}
