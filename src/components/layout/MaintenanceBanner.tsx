import { Icon } from "@/components/icons";
import { getSetting } from "@/server/services/settings.service";
import { getT } from "@/i18n/server";

/** Site-wide notice while maintenance mode is on (purchases and top-ups are paused). */
export async function MaintenanceBanner() {
  const m = await getSetting("maintenance").catch(() => null);
  if (!m?.enabled) return null;
  const t = await getT();
  return (
    <div role="status" className="bg-accent-tint text-fg">
      <p className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <Icon name="alert" size={16} className="shrink-0 text-accent" />
        <span>
          <b className="font-semibold">{t("header.maintenance")}</b>{" "}
          {m.message || t("header.maintenanceDefault")}
        </span>
      </p>
    </div>
  );
}
