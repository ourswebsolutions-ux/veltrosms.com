"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-browser UI preferences. Storage can be unavailable (private mode, blocked
 * cookies), so every access is guarded and falls back to defaults.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "ui-theme";
export const SOUND_KEY = "ui-sms-sound";

const CHANGE_EVENT = "ui-pref-change";

function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** A string preference synced across components and tabs. `null` during SSR. */
export function usePref(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => null,
  );
  const set = useCallback((v: string) => writePref(key, v), [key]);
  return [value, set];
}

/** Current theme as applied to <html>; `null` until hydrated. */
export function useTheme(): [Theme | null, (theme: Theme) => void] {
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as Theme,
    () => null,
  );
  const set = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    writePref(THEME_KEY, next);
  }, []);
  return [theme, set];
}
