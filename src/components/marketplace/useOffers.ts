"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OfferGroup, Result } from "@/types/catalog";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | Result<OfferGroup[]>;

/**
 * Loads offer groups for a service or a country from our public catalog API.
 * Pass `initial` (server-rendered) to skip the first request.
 */
export function useOffers(
  query: { service: string } | { country: string },
  initial?: { key: string; result: Result<OfferGroup[]> },
) {
  const key = "service" in query ? `service=${query.service}` : `country=${query.country}`;
  const [state, setState] = useState<State>(
    initial && initial.key === key ? initial.result : { status: "loading" },
  );
  const [reloadToken, setReloadToken] = useState(0);
  const skipFirst = useRef(initial?.key === key);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/v1/catalog/offers?${key}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Result<OfferGroup[]>;
      })
      .then(setState)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("[offers] request failed", err);
        setState({ status: "error", message: "We couldn't load prices. Check your connection." });
      });
    return () => controller.abort();
  }, [key, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  return { state, reload };
}
