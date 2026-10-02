/**
 * Builds src/config/service-logos.json — the icon for EVERY catalog service,
 * keyed by the provider service code (stable; display names can change).
 *
 *   npm run logos:map        # after a catalog sync adds services
 *   npm run logos:generate   # then write the SVG files
 *
 * Each code gets, in order:
 *   1. its existing entry (hand edits and earlier reviews are kept);
 *   2. a reviewed logo from LOGOS below;
 *   3. the official brand mark from Simple Icons when the service name (or a
 *      part of a combined name like "Instagram + Threads") is exactly a brand
 *      title — except REJECT (same name, different company);
 *   4. a category icon (bank, betting, shopping…) from CATEGORY_OVERRIDES or
 *      keyword rules on the name;
 *   5. the neutral app icon ("app").
 * Names are only read here, once, to propose the mapping; the site looks
 * icons up by code.
 */
import "./_env";
import { readFileSync, writeFileSync } from "node:fs";
import * as simpleIcons from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import { db } from "@/server/db";

const FILE = "src/config/service-logos.json";

type Logo = { icon: string; brand: string; from: string };
type Mapping = { logos: Record<string, Logo>; categories: Record<string, string> };

/** Reviewed logos: code → [source, brand]. Sources: "si:<slug>" (Simple Icons), "logos:<name>" (Iconify logos, CC0), "custom:<name>". */
const LOGOS: Record<string, [string, string]> = {
  wa: ["si:whatsapp", "WhatsApp"], tg: ["si:telegram", "Telegram"], fb: ["si:facebook", "Facebook"], ig: ["si:instagram", "Instagram"],
  lf: ["si:tiktok", "TikTok"], go: ["si:google", "Google"], ds: ["si:discord", "Discord"], ub: ["si:uber", "Uber"], tw: ["si:x", "X"],
  fu: ["si:snapchat", "Snapchat"], bnl: ["si:reddit", "Reddit"], wx: ["si:apple", "Apple"], mt: ["si:steam", "Steam"], ts: ["si:paypal", "PayPal"],
  aon: ["si:binance", "Binance"], nf: ["si:netflix", "Netflix"], vi: ["si:viber", "Viber"], wb: ["si:wechat", "WeChat"], dh: ["si:ebay", "eBay"],
  mm: ["custom:microsoft", "Microsoft"], am: ["custom:amazon", "Amazon"],
  bye: ["si:whatsapp", "WhatsApp"], bqa: ["si:airasia", "AirAsia"], ab: ["si:alibabadotcom", "Alibaba"], hwhk: ["si:alipay", "Alipay"],
  bt: ["si:battledotnet", "Battle.net"], gmsg: ["si:googlemessages", "Google Messages"], rcs: ["si:googlemessages", "Google Messages"],
  ggls: ["si:google", "Google"], gf: ["si:google", "Google"], gps: ["si:grab", "Grab"], me: ["si:line", "LINE"], lnwr: ["si:line", "LINE"],
  sq: ["si:kucoin", "KuCoin"], bab: ["si:opera", "Opera"], bob: ["si:shell", "Shell"], shll: ["si:shell", "Shell"], akx: ["si:sony", "Sony"],
  cbz: ["si:starlingbank", "Starling Bank"], bby: ["si:tata", "Tata"], acs: ["si:tata", "Tata"], qmp: ["si:tata", "Tata"], ace: ["si:tata", "Tata"],
  suz: ["si:suzuki", "Suzuki"], bwm: ["si:yamahamotorcorporation", "Yamaha Motor"], jq: ["si:paysafe", "Paysafe"], qq: ["si:qq", "QQ"],
  kf: ["si:sinaweibo", "Weibo"], byh: ["logos:adobe-icon", "Adobe"], ata: ["logos:authy", "Authy"], gr_ur: ["logos:azure-icon", "Azure"],
  axq: ["logos:eventbrite-icon", "Eventbrite"], grk: ["logos:grok-icon", "Grok"], tn: ["logos:linkedin-icon", "LinkedIn"], ex: ["logos:linode", "Linode"],
  gr_pe: ["logos:periscope", "Periscope"], rc: ["logos:skype", "Skype"], ee: ["logos:twilio-icon", "Twilio"], mb: ["logos:yahoo", "Yahoo"],
  gr_aw: ["logos:aws", "AWS"],
};

/** Exact-name matches that are a different company (e.g. "GO" ≠ the Go language, "Metro" ≠ Metro bundler). */
const REJECT = new Set(["bxg", "qk", "bgy", "cadd", "cag", "g68f", "hm", "bv", "aex", "ary", "amd", "lz"]);

/** Reviewed category corrections where the keyword rules guess wrong ("app" = neutral icon). */
const CATEGORY_OVERRIDES: Record<string, string> = {
  "acb": "jobs", "acy": "telecom", "ada": "social", "adk": "finance", "aef": "games", "afi": "finance", "agd": "shopping", "ahz": "app",
  "aie": "dating", "ajf": "social", "ajv": "app", "akg": "games", "akh": "app", "alb": "travel", "aly": "app", "aoq": "shopping",
  "aou": "app", "aoy": "utility", "apt": "finance", "apy": "app", "ara": "app", "are": "travel", "art": "ride", "auu": "app",
  "avb": "food", "avl": "finance", "avw": "app", "awj": "finance", "awo": "app", "axa": "app", "axc": "app", "axi": "app",
  "axj": "finance", "axo": "shopping", "axr": "dating", "aym": "music", "ays": "app", "ayv": "video", "aza": "app", "azo": "travel",
  "bak": "cloud", "bcw": "finance", "bdu": "games", "bfp": "app", "bfz": "finance", "bgc": "shopping", "bgl": "app", "bgm": "betting",
  "biv": "app", "bj": "app", "bjz": "dating", "bkb": "app", "bmd": "messaging", "bmt": "utility", "bno": "app", "bnp": "food",
  "boe": "utility", "bqh": "utility", "bqi": "app", "bqx": "utility", "bry": "ride", "brz": "app", "bsv": "finance", "bsy": "finance",
  "btc": "telecom", "bu": "utility", "bvd": "app", "bwb": "betting", "byd": "jobs", "bzk": "app", "bzn": "app", "bzt": "app",
  "caf": "betting", "cch": "games", "clg": "betting", "cm69": "app", "con": "app", "cs": "app", "dd": "messaging", "do": "shopping",
  "dt": "food", "eit": "games", "eni": "utility", "fan": "video", "fe": "app", "gas": "utility", "gi": "app", "gr_bg": "games",
  "gr_fc": "app", "gr_fr": "shopping", "gr_io": "app", "gr_le": "cloud", "gr_mc": "app", "gr_ob": "messaging", "gr_rb": "betting",
  "ix": "finance", "kd": "education", "kk": "app", "le": "app", "lic": "app", "lpg": "utility", "mde": "app", "mdw": "shopping",
  "mhs": "utility", "mih": "app", "mksh": "app", "mlnb": "shopping", "nk": "shopping", "ob": "shopping", "oi": "dating", "ol": "shopping",
  "pcm6": "ai", "pol": "betting", "pt": "shopping", "pw": "app", "qim": "utility", "qiy": "app", "qs": "dating", "res": "app",
  "rol": "utility", "sfc": "betting", "sj": "app", "sli": "app", "tle": "app", "ubr_gr": "travel", "uo": "shopping", "vr": "app",
  "vz": "dating", "wmh": "betting", "yg": "education", "yw": "dating", "zi": "shopping",
};

export const CATEGORIES = [
  "finance", "crypto", "betting", "games", "shopping", "food", "delivery", "ride", "travel", "dating", "ai",
  "video", "music", "messaging", "jobs", "health", "education", "social", "telecom", "cloud", "utility", "app",
] as const;

/** First matching rule wins (order matters: "BetPay" is betting, "CoinPay" is crypto). */
const RULES: [string, RegExp][] = [
  ["betting", /bet|casino|slot|jackpot|poker|lott|bingo|rummy|teen ?patti|777|vegas|spin|sportsbook|odds|wager|exch\b|baccarat|roulette|toto|\bwin\d|win$|\bwinz?o?\b|play\d|dafa|stake|parimatch|melbet|mostbet|dream11|fantasy|\blot\b|lucky|jogo|aposta|cassino/],
  ["crypto", /crypto|coin|bitcoin|\bbtc|\beth\b|token|blockchain|chain|web3|\bnft|defi|swap|\bdex\b|bybit|okx|bitget|mexc|huobi|htx|gate\.?io|\bbit|satoshi|ledger|metamask/],
  ["finance", /bank|banco|\bpay|pay\b|paisa|pesa|peso|money|cash|kredi|credit|cred\b|loan|lend|pinjam|dana\b|rupee|rupiya|financ|fintech|capital|invest|trade|trading|stock|forex|\bfx\b|wallet|card|insur|seguro|fund|wealth|\btax|remit|transfer|wise\b|bill/],
  ["games", /game|gaming|ludo|craft|legend|clash|arena|quest|puzzle|chess|\bplay|player|esport|xbox|nintendo|playstation|garena|gamer|\brpg|battle|warrior|hero/],
  ["food", /food|\beat|eats\b|pizza|burger|kitchen|cafe|coffee|tea\b|chicken|restaurant|meal|grocer|resto|bakery|sushi|taco|domino|subway|talabat|getir|blinkit|zepto|fresh|fruit|drink|juice|beer|wine/],
  ["shopping", /shop|store|mart\b|mart|market|mall|\bbuy|deal|bazaa?r|kart|cart|fashion|outlet|retail|commerce|boutique|wear|cloth|shoe|beauty|cosmetic|super|hyper|discount|coupon|sale|temu|shein|lazada|tokopedia|trendyol|noon|daraz|meesho|walmart|olx|avito|ozon|wildberries|flipkart|myntra|coupang|pinduoduo|jd\.com|gift/],
  ["delivery", /deliver|courier|express|post\b|postal|logistic|ship|parcel|cargo|freight|dpd|gls\b/],
  ["ride", /taxi|\bcab|ride|\bcar\b|cars\b|drive|bike|moto|scooter|rental|\bbus\b|\brail|train|transit|parking|lyft|bolt|careem|didi|yango|indrive|ola\b|rapido|blablacar|cabify/],
  ["travel", /travel|trip|\bair|airline|airways|aero|flight|\bfly|hotel|booking|tour|holiday|vacation|resort|hostel|agoda|expedia|cruise|ticket/],
  ["dating", /dating|\bdate|match|love|meet|flirt|single|cupid|heart|romance|\bher\b|tinder|bumble|hinge|happn|lovoo|tantan|grindr|feeld|taimi|skout|mamba|momo|kiss|crush|amor/],
  ["ai", /\bai\b|\bai |gpt|openai|gemini|copilot|llm|neural|chatbot|\bbot\b/],
  ["video", /\btv\b|tv$|video|stream|\blive|live\b|movie|film|cinema|anime|tube|reels|shorts|watch|hotstar|disney|hulu|hbo|kwai|likee|bigo|tango/],
  ["music", /music|radio|song|audio|podcast|karaoke/],
  ["messaging", /mail|messenger|message|\bmsg|sms|\bchat|call|voip|phone|\btel\b|talk|voice|text|\bimo\b|truecaller|contact/],
  ["jobs", /\bjob|career|\bwork|hire|hiring|freelanc|resume|recruit|talent|employ|\bgig|naukri/],
  ["health", /health|\bmed|medic|pharma|clinic|doctor|hospital|fitness|\bfit|\bgym|yoga|wellness|dental|apollo|nutri/],
  ["education", /learn|academy|\bedu|school|study|course|tutor|college|universit|exam|quiz|lingo|language|\bskill|teach/],
  ["social", /social|friend|community|forum|photo|insta|\bvk\b|weibo|sharechat/],
  ["telecom", /telecom|mobile|cellular|\bgsm|\bsim\b|esim|recharge|top-?up|airtime|internet|broadband|wifi|fiber|\bjio|vodafone|\bmts\b|telkomsel|indosat/],
  ["cloud", /cloud|\bhost|server|\bvps|domain|\bdns|\bapi\b|\bcode|software|\bsaas|\bdata|vpn|proxy|security|\bauth/],
];

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

function category(code: string, name: string): string {
  if (CATEGORY_OVERRIDES[code]) return CATEGORY_OVERRIDES[code];
  const n = name.toLowerCase();
  return RULES.find(([, re]) => re.test(n))?.[0] ?? "app";
}

/** Output file name for a logo source ("si:whatsapp" → "whatsapp"). */
export const iconFile = (from: string) => from.slice(from.indexOf(":") + 1);

async function main() {
  const services = await db().service.findMany({ select: { providerCode: true, name: true }, orderBy: { providerCode: "asc" } });
  let previous: Mapping = { logos: {}, categories: {} };
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    if (parsed.logos && parsed.categories) previous = parsed;
  } catch {}

  const icons = Object.values(simpleIcons).filter((i): i is SimpleIcon => Boolean(i && typeof i === "object" && "slug" in i));
  const byTitle = new Map<string, (typeof icons)[number]>();
  for (const i of icons) for (const k of [norm(i.title), i.slug]) if (k && !byTitle.has(k)) byTitle.set(k, i);

  const out: Mapping = { logos: {}, categories: {} };
  for (const { providerCode: code, name } of services) {
    if (previous.logos[code]) out.logos[code] = previous.logos[code];
    else if (LOGOS[code]) out.logos[code] = { icon: iconFile(LOGOS[code][0]), brand: LOGOS[code][1], from: LOGOS[code][0] };
    else if (previous.categories[code]) out.categories[code] = previous.categories[code];
    else {
      const parts = [name, ...name.split(/\s*(?:\+|,|\/|\(|\)|\||\s-\s)\s*/)].map(norm).filter(Boolean);
      const hit = REJECT.has(code) ? undefined : parts.map((p) => byTitle.get(p)).find(Boolean);
      if (hit) out.logos[code] = { icon: hit.slug, brand: hit.title, from: `si:${hit.slug}` };
      else out.categories[code] = category(code, name);
    }
  }
  writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
  const counts = Object.values(out.categories).reduce<Record<string, number>>((m, c) => ((m[c] = (m[c] ?? 0) + 1), m), {});
  console.log(`${services.length} services: ${Object.keys(out.logos).length} brand logos, categories ${JSON.stringify(counts)}`);
}

main()
  .catch((error) => {
    console.error("Logo mapping failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db().$disconnect());
