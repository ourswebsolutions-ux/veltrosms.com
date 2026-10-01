"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, dirOf, type Locale } from "./config";
import { en } from "./messages/en";
import { createTranslator, type Messages, type Translator } from "./translate";

type Ctx = { locale: Locale; t: Translator };
const I18nContext = createContext<Ctx | null>(null);

/** Supplies the active language's dictionary to client components (only that language is sent to the browser, plus English as the source). */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(messages, en) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

const fallback: Ctx = { locale: DEFAULT_LOCALE, t: createTranslator(en, en) };

export function useT(): Translator {
  return (useContext(I18nContext) ?? fallback).t;
}

export function useLocale(): { locale: Locale; dir: "ltr" | "rtl" } {
  const { locale } = useContext(I18nContext) ?? fallback;
  return { locale, dir: dirOf(locale) };
}
