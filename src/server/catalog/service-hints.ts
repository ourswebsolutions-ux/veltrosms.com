import "server-only";

/**
 * Presentation defaults for well-known service codes (sms-activate style).
 * Names always come from the provider; this only sets which services are
 * featured first and their avatar colour. Admins can override in the DB later.
 */
export const POPULAR_SERVICES: { code: string; color: string }[] = [
  { code: "wa", color: "#25d366" }, // WhatsApp
  { code: "tg", color: "#2aabee" }, // Telegram
  { code: "go", color: "#4285f4" }, // Google
  { code: "fb", color: "#1877f2" }, // Facebook
  { code: "ig", color: "#e1306c" }, // Instagram
  { code: "lf", color: "#111111" }, // TikTok
  { code: "am", color: "#ff9900" }, // Amazon
  { code: "wx", color: "#555555" }, // Apple
  { code: "ts", color: "#003087" }, // PayPal
  { code: "mm", color: "#00a4ef" }, // Microsoft
  { code: "dr", color: "#10a37f" }, // OpenAI
  { code: "ot", color: "#8a8f98" }, // Any other
];

const COLORS = new Map(POPULAR_SERVICES.map((s) => [s.code, s.color]));
const PALETTE = ["#fa7900", "#2aabee", "#25d366", "#e1306c", "#6366f1", "#0ea5e9", "#f43f5e", "#14b8a6", "#8b5cf6", "#f59e0b"];

export function serviceColor(code: string, name: string): string {
  const known = COLORS.get(code);
  if (known) return known;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function popularRank(code: string): number | null {
  const i = POPULAR_SERVICES.findIndex((s) => s.code === code);
  return i === -1 ? null : i;
}
