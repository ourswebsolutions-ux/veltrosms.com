/** Interface languages. English is the default and the source of every translation. */
export const LOCALES = ["en", "ur", "hi", "bn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
/** Cookie holding the visitor's language (a harmless preference, readable by the server for the first render). */
export const LOCALE_COOKIE = "lang";

/** Each language in its own script, for the selector. */
export const LOCALE_NAMES: Record<Locale, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  ur: { native: "اردو", english: "Urdu" },
  hi: { native: "हिन्दी", english: "Hindi" },
  bn: { native: "বাংলা", english: "Bengali" },
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
/** Urdu is written right-to-left; the others left-to-right. */
export const dirOf = (l: Locale): "rtl" | "ltr" => (l === "ur" ? "rtl" : "ltr");
/** BCP 47 tag for Intl date formatting. */
export const intlLocale = (l: Locale): string => ({ en: "en-US", ur: "ur-PK", hi: "hi-IN", bn: "bn-BD" })[l];
