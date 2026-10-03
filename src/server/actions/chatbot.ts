"use server";

import { revalidatePath } from "next/cache";
import { hitRateLimit, RATE_LIMITS } from "@/server/auth/rate-limit";
import { getRequestContext } from "@/server/auth/request";
import { activateChatbot } from "@/server/services/chatbot-subscription";

/** Footer "active" text: (re)activates the global chatbot subscription for one month. No login required. */
export async function activateChatbotAction(): Promise<{ ok: boolean }> {
  const { ip } = await getRequestContext();
  const limit = await hitRateLimit(`chatbot:activate:ip:${ip || "unknown"}`, RATE_LIMITS.chatbotActivatePerIp);
  if (!limit.allowed) return { ok: false };
  await activateChatbot();
  revalidatePath("/", "layout");
  return { ok: true };
}
