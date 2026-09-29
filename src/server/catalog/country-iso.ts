import "server-only";

/**
 * Maps a provider's English country name to an ISO 3166-1 alpha-2 code (for
 * flags). Built from the runtime's own region names (Intl.DisplayNames) plus
 * aliases for spellings providers commonly use. Unknown names return null.
 */

const ALIASES: Record<string, string> = {
  usa: "us",
  "united states of america": "us",
  uk: "gb",
  england: "gb",
  "great britain": "gb",
  russia: "ru",
  swaziland: "sz",
  "czech republic": "cz",
  "ivory coast": "ci",
  "cote divoire": "ci",
  "dr congo": "cd",
  "democratic republic of the congo": "cd",
  "congo dem republic": "cd",
  congo: "cg",
  "republic of the congo": "cg",
  "south korea": "kr",
  korea: "kr",
  "north korea": "kp",
  laos: "la",
  vietnam: "vn",
  macao: "mo",
  macau: "mo",
  "hong kong": "hk",
  taiwan: "tw",
  moldova: "md",
  bolivia: "bo",
  venezuela: "ve",
  iran: "ir",
  syria: "sy",
  tanzania: "tz",
  palestine: "ps",
  brunei: "bn",
  "brunei darussalam": "bn",
  "cape verde": "cv",
  "east timor": "tl",
  macedonia: "mk",
  "north macedonia": "mk",
  burma: "mm",
  kosovo: "xk",
  turkey: "tr",
  turkiye: "tr",
  reunion: "re",
  gambia: "gm",
  bahamas: "bs",
  netherlands: "nl",
  eswatini: "sz",
  "cayman islands": "ky",
  "guinea bissau": "gw",
  "papua new guinea": "pg",
  "saint vincent": "vc",
  "trinidad and tobago": "tt",
  "bosnia and herzegovina": "ba",
  "antigua and barbuda": "ag",
  "sao tome and principe": "st",
  "united arab emirates": "ae",
  uae: "ae",
  // Spellings seen in the live provider catalog.
  lao: "la",
  argentinas: "ar",
  czech: "cz",
  "papua new gvineya": "pg",
  salvador: "sv",
  nambia: "na",
};

export function normalizeCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // "USA (virtual)" → "usa"
    .replace(/&/g, " and ")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the\s+/, "")
    .trim();
}

/**
 * Retired or reserved codes the runtime still names (e.g. DD "Germany",
 * UK "United Kingdom", SU "Soviet Union"). They must never win over the
 * current code, and flag sets don't include them.
 */
const NON_CURRENT = new Set(["DD", "UK", "SU", "YU", "ZR", "CS", "BU", "TP", "AN", "NT", "FX", "YD", "QO", "EU", "EZ", "UN", "ZZ", "XA", "XB", "AA"]);

let byName: Map<string, string> | undefined;

function table(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const A = "A".charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const code = String.fromCharCode(A + i, A + j);
      if (NON_CURRENT.has(code)) continue;
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        continue;
      }
      // Unknown codes echo back unchanged. First match wins, so official codes
      // (GB) beat exceptionally-reserved aliases that share a name (UK).
      const key = name && name !== code ? normalizeCountryName(name) : null;
      if (key && !byName.has(key)) byName.set(key, code.toLowerCase());
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) byName.set(normalizeCountryName(alias), code);
  return byName;
}

export function isoForCountryName(name: string): string | null {
  return table().get(normalizeCountryName(name)) ?? null;
}
