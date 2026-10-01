import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { dictionaries } from "./messages";
import { createTranslator, type Translator } from "./translate";

/** The visitor's language (cookie), English by default. Cached per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Translator for server components and page metadata. */
export const getT = cache(async (): Promise<Translator> => createTranslator(dictionaries[await getLocale()], dictionaries.en));

export async function getMessages() {
  return dictionaries[await getLocale()];
}
