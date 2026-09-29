import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Page-width wrapper shared by header, content and footer so edges align. */
export function PageContainer({
  className,
  size = "wide",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "wide" | "narrow" | "form" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-3 sm:px-6 xl:px-11",
        size === "wide" && "max-w-[1440px]",
        size === "narrow" && "max-w-[1100px]",
        size === "form" && "max-w-[860px]",
        className,
      )}
      {...props}
    />
  );
}
