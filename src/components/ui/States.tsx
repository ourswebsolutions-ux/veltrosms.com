"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";
import { useT } from "@/i18n/client";

function StateShell({
  icon,
  iconClassName,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          compact ? "size-11" : "size-14",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <div className="max-w-sm">
        <p className={cn("font-semibold text-fg", compact ? "text-[15px]" : "text-lg")}>{title}</p>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  ...props
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <StateShell
      icon={<Icon name={icon} size={props.compact ? 22 : 26} />}
      iconClassName="bg-primary-tint text-primary"
      {...props}
    />
  );
}

export function ErrorState({
  title,
  ...props
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <StateShell
      icon={<Icon name="alert" size={props.compact ? 22 : 26} />}
      iconClassName="bg-danger-tint text-danger"
      title={title ?? t("common.somethingWrong")}
      {...props}
    />
  );
}

export function LoadingState({
  label,
  compact,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-fg-muted",
        compact ? "py-8" : "py-16",
        className,
      )}
    >
      <Spinner size={compact ? 24 : 32} className="text-primary" />
      <span className="text-sm">{label ?? t("common.loading")}</span>
    </div>
  );
}
