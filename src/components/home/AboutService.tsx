import { Icon, type IconName } from "@/components/icons";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { siteConfig } from "@/config/site";
import type { MessageKey, Translator } from "@/i18n/translate";

/** What people use the numbers for (shared by the home section and /about). */
export const USE_CASES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "shield", title: "about.use1", body: "about.use1Body" },
  { icon: "user", title: "about.use2", body: "about.use2Body" },
  { icon: "globe", title: "about.use3", body: "about.use3Body" },
  { icon: "code", title: "about.use4", body: "about.use4Body" },
];

/** Why the service can be trusted. */
export const TRUST: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: "refresh", title: "about.trust1", body: "about.trust1Body" },
  { icon: "lock", title: "about.trust2", body: "about.trust2Body" },
  { icon: "wallet", title: "about.trust3", body: "about.trust3Body" },
  { icon: "message", title: "about.trust4", body: "about.trust4Body" },
];

export function FeatureGrid({ items, t, columns = 2 }: { items: { icon: IconName; title: MessageKey; body: MessageKey }[]; t: Translator; columns?: 2 | 4 }) {
  return (
    <ul className={columns === 4 ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
      {items.map((b) => (
        <li key={b.title} className="flex min-w-0 gap-3 rounded-xl bg-surface-muted p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <Icon name={b.icon} size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{t(b.title)}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{t(b.body)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "About our service" on the home page: what we provide, what it's for, why trust it. */
export function AboutService({ t }: { t: Translator }) {
  return (
    <Card className="border border-line bg-[linear-gradient(180deg,var(--color-surface-sunken)_0%,var(--color-surface-muted)_40%)] shadow-none">
      <p className="text-lg font-medium text-primary">{t("home.about")}</p>
      <h2 className="mt-1 text-2xl font-semibold sm:text-[28px]">{t("home.aboutTitle")}</h2>
      <div className="mt-3 max-w-3xl space-y-3 text-[15px] leading-relaxed text-fg-muted">
        <p>{t("home.aboutP1", { name: siteConfig.name })}</p>
        <p>{t("about.readyMadeP", { name: siteConfig.name })}</p>
      </div>

      <h3 className="mt-6 text-lg font-semibold">{t("about.useTitle")}</h3>
      <div className="mt-3">
        <FeatureGrid items={USE_CASES} t={t} />
      </div>

      <h3 className="mt-6 text-lg font-semibold">{t("about.trustTitle")}</h3>
      <div className="mt-3">
        <FeatureGrid items={TRUST} t={t} />
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/about" variant="outline">
          {t("about.learnMore")} <Icon name="arrowRight" size={16} />
        </ButtonLink>
        <ButtonLink href="/register">{t("home.createFree")}</ButtonLink>
        <ButtonLink href="/price" variant="ghost">
          {t("home.viewPrices")}
        </ButtonLink>
      </div>
    </Card>
  );
}
