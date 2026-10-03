import "server-only";
import { getSetting, saveSetting } from "./settings.service";

/**
 * The single, global chatbot subscription (not per user). It is active from
 * `activatedAt` until `expiresAt`, both set from the SERVER clock; the browser's
 * date, cookies and storage play no part. Activating — again or while still
 * active — always sets a fresh month from now. Stored as one `settings` row
 * (key "chatbot_subscription"), so repeated or concurrent clicks overwrite the
 * same record instead of creating more.
 */

export type ChatbotSubscription = { active: boolean; activatedAt: string | null; expiresAt: string | null };

/** `date` plus one calendar month (UTC); Jan 31 → Feb 28/29, never spilling into March. */
export function addOneMonth(date: Date): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export async function getChatbotSubscription(now = new Date()): Promise<ChatbotSubscription> {
  const s = await getSetting("chatbot_subscription");
  const active = Boolean(s.expiresAt && new Date(s.expiresAt).getTime() > now.getTime());
  return { active, activatedAt: s.activatedAt, expiresAt: s.expiresAt };
}

export async function isChatbotActive(): Promise<boolean> {
  return (await getChatbotSubscription()).active;
}

/** Starts (or renews) the global subscription: activatedAt = now, expiresAt = now + 1 month. */
export async function activateChatbot(now = new Date()): Promise<ChatbotSubscription> {
  const saved = await saveSetting("chatbot_subscription", { activatedAt: now.toISOString(), expiresAt: addOneMonth(now).toISOString() });
  return { active: true, activatedAt: saved.activatedAt, expiresAt: saved.expiresAt };
}
