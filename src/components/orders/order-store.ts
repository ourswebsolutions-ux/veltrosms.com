"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { ACTIVE_ORDER_STATUSES, type OrderListItem } from "@/types/account";

/**
 * Client-side cache of live orders with exactly one polling loop per order,
 * however many cards show it (sidebar, price page, profile). Polling pauses
 * while the tab is hidden and stops once the order reaches a final status.
 */

const POLL_MS = 5_000;

type Entry = {
  order: OrderListItem;
  subscribers: Set<() => void>;
  timer: number | null;
  inFlight: boolean;
};

const entries = new Map<string, Entry>();

const isLive = (o: OrderListItem) => ACTIVE_ORDER_STATUSES.includes(o.status);

function notify(entry: Entry) {
  for (const fn of entry.subscribers) fn();
}

/** Stores a fresher copy of an order (from a poll, an action or a server render). */
export function publishOrder(order: OrderListItem) {
  const entry = entries.get(order.id);
  if (!entry) {
    entries.set(order.id, { order, subscribers: new Set(), timer: null, inFlight: false });
    return;
  }
  // A final state never goes back to live (a stale server render can't undo it).
  if (!isLive(entry.order) && isLive(order)) return;
  if (JSON.stringify(entry.order) === JSON.stringify(order)) return;
  entry.order = order;
  notify(entry);
  schedule(entry);
}

async function poll(entry: Entry) {
  if (entry.inFlight || document.visibilityState !== "visible") return;
  entry.inFlight = true;
  try {
    const res = await fetch(`/api/orders/${entry.order.id}`, { cache: "no-store" });
    if (res.status === 401) return clearOrderStore(); // signed out / session expired
    if (res.ok) publishOrder(((await res.json()) as { order: OrderListItem }).order);
  } catch {
    /* transient network error: the next tick retries */
  } finally {
    entry.inFlight = false;
  }
}

function schedule(entry: Entry) {
  const shouldRun = entry.subscribers.size > 0 && isLive(entry.order);
  if (shouldRun && entry.timer === null) {
    entry.timer = window.setInterval(() => void poll(entry), POLL_MS);
  } else if (!shouldRun && entry.timer !== null) {
    window.clearInterval(entry.timer);
    entry.timer = null;
  }
}

// Catch up immediately when the tab becomes visible again.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    for (const entry of entries.values()) if (entry.timer !== null) void poll(entry);
  });
}

/** Forgets every cached order and stops all polling (logout, expired session). */
export function clearOrderStore() {
  for (const entry of entries.values()) {
    if (entry.timer !== null) window.clearInterval(entry.timer);
    entry.timer = null;
    entry.subscribers.clear();
  }
  entries.clear();
}

function subscribe(id: string, fn: () => void) {
  const entry = entries.get(id);
  if (!entry) return () => {}; // cleared (logout): nothing to follow
  entry.subscribers.add(fn);
  schedule(entry);
  return () => {
    entry.subscribers.delete(fn);
    schedule(entry);
  };
}

/** The latest known state of an order, kept fresh while it is live. */
export function useLiveOrder(initial: OrderListItem): OrderListItem {
  if (!entries.has(initial.id)) publishOrder(initial);
  // Server renders after router.refresh() may carry newer data.
  useEffect(() => publishOrder(initial), [initial]);
  // Stable per order: re-subscribing on every render would reset the poll timer.
  const id = initial.id;
  const sub = useCallback((fn: () => void) => subscribe(id, fn), [id]);
  return useSyncExternalStore(
    sub,
    () => entries.get(initial.id)?.order ?? initial,
    () => initial,
  );
}
