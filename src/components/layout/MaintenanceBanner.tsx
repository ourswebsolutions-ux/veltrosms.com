import { Icon } from "@/components/icons";
import { getSetting } from "@/server/services/settings.service";

/** Site-wide notice while maintenance mode is on (purchases and top-ups are paused). */
export async function MaintenanceBanner() {
  const m = await getSetting("maintenance").catch(() => null);
  if (!m?.enabled) return null;
  return (
    <div role="status" className="bg-accent-tint text-fg">
      <p className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <Icon name="alert" size={16} className="shrink-0 text-accent" />
        <span>
          <b className="font-semibold">Maintenance in progress.</b>{" "}
          {m.message || "Buying numbers and adding funds are paused for a short while. Your balance and numbers are safe."}
        </span>
      </p>
    </div>
  );
}
