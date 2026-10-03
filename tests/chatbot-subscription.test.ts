import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { activateChatbot, addOneMonth, getChatbotSubscription } from "@/server/services/chatbot-subscription";
import { clearSettingsCache } from "@/server/services/settings.service";
import { resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
  clearSettingsCache();
});
afterAll(() => db().$disconnect());

const at = (iso: string) => new Date(iso);

describe("global chatbot subscription", () => {
  it("is inactive until activated", async () => {
    expect(await getChatbotSubscription()).toEqual({ active: false, activatedAt: null, expiresAt: null });
  });

  it("activates for exactly one calendar month from server time", async () => {
    const now = at("2026-10-03T12:00:00.000Z");
    const s = await activateChatbot(now);
    expect(s).toEqual({ active: true, activatedAt: "2026-10-03T12:00:00.000Z", expiresAt: "2026-11-03T12:00:00.000Z" });
    expect((await getChatbotSubscription(at("2026-11-03T11:59:59.000Z"))).active).toBe(true);
    expect((await getChatbotSubscription(at("2026-11-03T12:00:00.000Z"))).active).toBe(false); // lapses at expiresAt
  });

  it("clicking again (active or expired) resets to one month from that click; always one record", async () => {
    await activateChatbot(at("2026-10-03T12:00:00.000Z"));
    const renewed = await activateChatbot(at("2026-10-20T08:00:00.000Z"));
    expect(renewed.expiresAt).toBe("2026-11-20T08:00:00.000Z");
    expect((await getChatbotSubscription(at("2026-12-01T00:00:00.000Z"))).active).toBe(false);
    const again = await activateChatbot(at("2026-12-01T00:00:00.000Z"));
    expect(again.expiresAt).toBe("2027-01-01T00:00:00.000Z");
    // Concurrent clicks: still exactly one subscription row.
    await Promise.all(Array.from({ length: 5 }, () => activateChatbot()));
    expect(await db().setting.count({ where: { key: "chatbot_subscription" } })).toBe(1);
  });

  it("month arithmetic never overflows into the next month", () => {
    expect(addOneMonth(at("2026-01-31T10:00:00.000Z")).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addOneMonth(at("2028-01-31T10:00:00.000Z")).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addOneMonth(at("2026-12-15T00:00:00.000Z")).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });
});
