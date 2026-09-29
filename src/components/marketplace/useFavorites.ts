"use client";

import { useCallback, useMemo } from "react";
import { usePref } from "@/lib/preferences";

const KEY = "fav-countries";

/** Starred countries, kept per browser. Moves to the user profile once auth exists. */
export function useFavorites() {
  const [raw, setRaw] = usePref(KEY);

  const favorites = useMemo(() => {
    try {
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const toggle = useCallback(
    (iso2: string) => {
      const next = new Set(favorites);
      if (next.has(iso2)) next.delete(iso2);
      else next.add(iso2);
      setRaw(JSON.stringify([...next]));
    },
    [favorites, setRaw],
  );

  return { favorites, toggle };
}
