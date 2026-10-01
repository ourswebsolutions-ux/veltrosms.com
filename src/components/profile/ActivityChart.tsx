import type { OrderStats } from "@/types/account";
import { getLocale, getT } from "@/i18n/server";
import { intlLocale } from "@/i18n/config";

const W = 700;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };

/**
 * Activations per day as stacked bars (successful + other). Plain SVG — no
 * charting dependency for one small chart. Includes a data table for screen
 * readers.
 */
export async function ActivityChart({ days }: { days: OrderStats["byDay"] }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const max = Math.max(1, ...days.map((d) => d.total));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / days.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / niceMax) * innerH;
  const ticks = [0, niceMax / 2, niceMax];
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <figure dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="activity-title">
        <title id="activity-title">{t("stats.perDay", { days: days.length })}</title>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--color-line)" />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--color-fg-subtle)">
              {tick}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const other = d.total - d.completed;
          return (
            <g key={d.date}>
              <title>{`${label(d.date)}: ${d.total} total, ${d.completed} successful`}</title>
              {other > 0 && (
                <rect x={x} y={y(d.total)} width={barW} height={y(d.completed) - y(d.total)} rx="3" fill="var(--color-primary-tint-border)" />
              )}
              {d.completed > 0 && (
                <rect x={x} y={y(d.completed)} width={barW} height={y(0) - y(d.completed)} rx="3" fill="var(--color-primary)" />
              )}
              {(i % 2 === 0 || days.length <= 7) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-fg-subtle)">
                  {label(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-[13px] text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> {t("stats.successful")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary-tint-border" /> {t("stats.cancelled")}
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{t("stats.dayTitle")}</caption>
        <thead>
          <tr>
            <th>{t("common.date")}</th>
            <th>{t("common.total")}</th>
            <th>{t("stats.successful")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{label(d.date)}</td>
              <td>{d.total}</td>
              <td>{d.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
