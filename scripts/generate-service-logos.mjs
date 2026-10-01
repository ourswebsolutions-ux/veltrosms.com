/**
 * Writes the service logo badges in public/service-logos/ from
 * src/config/service-logos.json (provider service code → brand icon).
 *
 *   npm run logos:generate
 *
 * Glyphs come from Simple Icons (CC0 icon data; brand marks belong to their
 * owners and are used only to identify the service). Microsoft isn't in Simple
 * Icons; its four-square mark is drawn here. Each badge is a brand-coloured
 * circle (32×32 viewBox) like the letter avatars it replaces.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as icons from "simple-icons";

const OUT = "public/service-logos";
const mapping = JSON.parse(readFileSync("src/config/service-logos.json", "utf8"));
const bySlug = Object.fromEntries(Object.values(icons).filter((i) => i && typeof i === "object" && i.slug).map((i) => [i.slug, i]));

/** Light backgrounds (e.g. Snapchat yellow) get a dark glyph. */
const isLight = (hex) => {
  const n = parseInt(hex, 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 186;
};
const esc = (s) => s.replace(/[<&>"]/g, "");

const CUSTOM = {
  microsoft: (title) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>${title}</title>` +
    `<circle cx="16" cy="16" r="15.5" fill="#fff" stroke="#e5e7eb"/>` +
    `<rect x="8.5" y="8.5" width="7" height="7" fill="#f25022"/><rect x="16.5" y="8.5" width="7" height="7" fill="#7fba00"/>` +
    `<rect x="8.5" y="16.5" width="7" height="7" fill="#00a4ef"/><rect x="16.5" y="16.5" width="7" height="7" fill="#ffb900"/></svg>`,
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [code, { icon, brand }] of Object.entries(mapping)) {
  const title = esc(`${brand} logo`);
  let svg;
  if (CUSTOM[icon]) svg = CUSTOM[icon](title);
  else {
    const si = bySlug[icon];
    if (!si) throw new Error(`Unknown Simple Icons slug "${icon}" for service code "${code}"`);
    const glyph = isLight(si.hex) ? "#22252d" : "#ffffff";
    svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>${title}</title>` +
      `<circle cx="16" cy="16" r="16" fill="#${si.hex}"/>` +
      `<g transform="translate(7 7) scale(0.75)"><path fill="${glyph}" d="${si.path}"/></g></svg>`;
  }
  writeFileSync(`${OUT}/${icon}.svg`, svg);
}
console.log(`Wrote ${Object.keys(mapping).length} service logos to ${OUT}/`);
