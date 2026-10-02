/**
 * Writes the service icon badges in public/service-logos/ from
 * src/config/service-logos.json (built by `npm run logos:map`):
 *   - brand logos: "si:<slug>" from Simple Icons, "logos:<name>" from Iconify's
 *     "logos" set (both CC0 icon data; brand marks belong to their owners and
 *     are used only to identify the service), "custom:<name>" drawn below;
 *   - category badges (category-<name>.svg) for services without a logo, and
 *     the neutral category-app.svg for everything else.
 * Every badge is a 32×32 circle, like the avatars it replaces.
 *
 *   npm run logos:generate
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import * as simpleIcons from "simple-icons";

const require = createRequire(import.meta.url);
const iconifyLogos = require("@iconify-json/logos/icons.json");

const OUT = "public/service-logos";
const mapping = JSON.parse(readFileSync("src/config/service-logos.json", "utf8"));
const bySlug = Object.fromEntries(Object.values(simpleIcons).filter((i) => i && typeof i === "object" && i.slug).map((i) => [i.slug, i]));

/** Light backgrounds (e.g. Snapchat yellow) get a dark glyph. */
const luma = (hex) => {
  const n = parseInt(hex, 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
const isLight = (hex) => luma(hex) > 186;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const open = (title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>${esc(title)}</title>`;
const whiteDisc = `<circle cx="16" cy="16" r="15.5" fill="#fff" stroke="#e5e7eb"/>`;

const CUSTOM = {
  microsoft: (title) =>
    open(title) +
    whiteDisc +
    `<rect x="8.5" y="8.5" width="7" height="7" fill="#f25022"/><rect x="16.5" y="8.5" width="7" height="7" fill="#7fba00"/>` +
    `<rect x="8.5" y="16.5" width="7" height="7" fill="#00a4ef"/><rect x="16.5" y="16.5" width="7" height="7" fill="#ffb900"/></svg>`,
  // Amazon's smile arrow (not in either icon set).
  amazon: (title) =>
    open(title) +
    `<circle cx="16" cy="16" r="16" fill="#232f3e"/>` +
    `<g fill="none" stroke="#ff9900" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M7.5 15.5q8.5 6 17 0"/><path d="M21.2 14.4l3.3 1.1-.6 3.4"/></g></svg>`,
};

function brandSvg(from, title) {
  const [source, name] = [from.slice(0, from.indexOf(":")), from.slice(from.indexOf(":") + 1)];
  if (source === "custom") {
    if (!CUSTOM[name]) throw new Error(`Unknown custom logo "${name}"`);
    return CUSTOM[name](title);
  }
  if (source === "si") {
    const si = bySlug[name];
    if (!si) throw new Error(`Unknown Simple Icons slug "${name}"`);
    const glyph = isLight(si.hex) ? "#22252d" : "#ffffff";
    // Near-white discs (e.g. Sony) get a hairline so they stay visible on white cards.
    const ring = luma(si.hex) > 235 ? ` stroke="#e5e7eb"` : "";
    return (
      open(title) +
      `<circle cx="16" cy="16" r="${ring ? 15.5 : 16}" fill="#${si.hex}"${ring}/>` +
      `<g transform="translate(7 7) scale(0.75)"><path fill="${glyph}" d="${si.path}"/></g></svg>`
    );
  }
  if (source === "logos") {
    const real = iconifyLogos.aliases?.[name]?.parent ?? name;
    const icon = iconifyLogos.icons[real];
    if (!icon) throw new Error(`Unknown Iconify logo "${name}"`);
    const w = icon.width ?? iconifyLogos.width ?? 16;
    const h = icon.height ?? iconifyLogos.height ?? 16;
    return open(title) + whiteDisc + `<svg x="7.5" y="7.5" width="17" height="17" viewBox="0 0 ${w} ${h}">${icon.body}</svg></svg>`;
  }
  throw new Error(`Unknown logo source "${from}"`);
}

/** Category glyphs: 24×24 stroke drawings (white on a coloured disc). */
const CATEGORIES = {
  finance: ["#0f766e", "Bank or payments", `<path d="M3 21h18M4 10h16M12 3 3 8h18zM6 10v8m4-8v8m4-8v8m4-8v8"/>`],
  crypto: ["#d97706", "Crypto", `<circle cx="12" cy="12" r="9"/><path d="M9.5 7.5v9m0-9h3.3a2.2 2.2 0 0 1 0 4.5H9.5m0 0h3.8a2.25 2.25 0 0 1 0 4.5H9.5M11.5 6v1.5m0 9V18"/>`],
  betting: ["#b91c1c", "Betting or casino", `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="#fff"/><circle cx="15.5" cy="15.5" r="1.2" fill="#fff"/><circle cx="12" cy="12" r="1.2" fill="#fff"/><circle cx="15.5" cy="8.5" r="1.2" fill="#fff"/><circle cx="8.5" cy="15.5" r="1.2" fill="#fff"/>`],
  games: ["#7c3aed", "Games", `<path d="M17.3 6H6.7a4 4 0 0 0-3.9 3.2l-1 5.3A2.8 2.8 0 0 0 4.6 18c.8 0 1.5-.4 2-1l1.4-1.8h8l1.4 1.8c.5.6 1.2 1 2 1a2.8 2.8 0 0 0 2.8-3.5l-1-5.3A4 4 0 0 0 17.3 6z"/><path d="M6.5 11h3M8 9.5v3"/><circle cx="15" cy="10.5" r=".6" fill="#fff"/><circle cx="17" cy="12.5" r=".6" fill="#fff"/>`],
  shopping: ["#db2777", "Shopping", `<path d="M5.5 7.5h13l1 13.5h-15zM9 7.5V6.5a3 3 0 0 1 6 0v1"/>`],
  food: ["#ea580c", "Food", `<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v5M17 21V3c-2 1-3.5 3.5-3.5 7.5V13H17"/>`],
  delivery: ["#a16207", "Delivery", `<path d="M21 7.5 12 3 3 7.5v9L12 21l9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9"/>`],
  ride: ["#0369a1", "Rides and transport", `<path d="M5 17H3.5v-4.5L5.5 7h13l2 5.5V17H19M3.5 12.5h17M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>`],
  travel: ["#0284c7", "Travel", `<path d="M10.5 13.5 6 20h2.5l5.5-5.5h4.5a1.5 1.5 0 0 0 0-3H14L8.5 6H6l4.5 5.5H6.5L5 9.5H3.5l1 3.5-1 3.5H5l1.5-2z"/>`],
  dating: ["#e11d48", "Dating", `<path d="M12 20.5 4.4 13A4.6 4.6 0 0 1 11 6.6l1 1 1-1A4.6 4.6 0 0 1 19.6 13z"/>`],
  ai: ["#4f46e5", "AI", `<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`],
  video: ["#dc2626", "Video and streaming", `<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/>`],
  music: ["#9333ea", "Music", `<path d="M9 18V5.5l11-2v12.5"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>`],
  messaging: ["#16a34a", "Calls and messaging", `<path d="M20 15.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 12.5h5"/>`],
  jobs: ["#475569", "Jobs and work", `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3 13h18"/>`],
  health: ["#059669", "Health", `<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>`],
  education: ["#2563eb", "Education", `<path d="M22 9.5 12 4.5 2 9.5l10 5zM6 11.5v5c3.5 2.5 8.5 2.5 12 0v-5M22 9.5v5"/>`],
  social: ["#0891b2", "Social", `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.2.7 3.5 2.9 3.5 5.7"/>`],
  telecom: ["#4338ca", "Mobile and telecom", `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18h3"/>`],
  cloud: ["#0ea5e9", "Online service", `<path d="M17.5 19H7.5a5 5 0 1 1 .9-9.9A6 6 0 0 1 19.6 11a4 4 0 0 1-2.1 8z"/>`],
  utility: ["#ca8a04", "Fuel and utilities", `<path d="M13 2.5 4 14h7.5l-1 7.5L20 10h-7.5z"/>`],
  app: ["#64748b", "App", `<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>`],
};

const categorySvg = ([color, title, glyph]) =>
  open(`${title} icon`) +
  `<circle cx="16" cy="16" r="16" fill="${color}"/>` +
  `<g transform="translate(7 7) scale(0.75)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const written = new Set();
for (const [code, { icon, brand, from }] of Object.entries(mapping.logos)) {
  if (written.has(icon)) continue;
  try {
    writeFileSync(`${OUT}/${icon}.svg`, brandSvg(from, `${brand} logo`));
  } catch (error) {
    throw new Error(`Service code "${code}": ${error.message}`);
  }
  written.add(icon);
}
for (const [name, def] of Object.entries(CATEGORIES)) writeFileSync(`${OUT}/category-${name}.svg`, categorySvg(def));
const unknown = [...new Set(Object.values(mapping.categories))].filter((c) => !CATEGORIES[c]);
if (unknown.length) throw new Error(`Categories without a badge: ${unknown.join(", ")}`);
console.log(`Wrote ${written.size} brand logos and ${Object.keys(CATEGORIES).length} category badges to ${OUT}/`);
