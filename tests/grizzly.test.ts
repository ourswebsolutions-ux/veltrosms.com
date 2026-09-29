import { describe, expect, it } from "vitest";
import { costToMinor, GrizzlyProvider } from "@/server/providers/grizzly/grizzly-provider";
import type { ProviderRequestLog } from "@/server/providers/types";

type Answer = string | { status?: number; body: string; headers?: Record<string, string> } | "TIMEOUT" | "NETWORK";

/**
 * Stub transport. Each action maps to one answer or a sequence (consumed per
 * call). Response bodies below mirror live answers captured from the real API.
 */
function provider(answers: Record<string, Answer | Answer[]>, opts: { rps?: number } = {}) {
  const logs: ProviderRequestLog[] = [];
  const seen: URL[] = [];
  const sleeps: number[] = [];
  const queues = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const fetchImpl = (async (input: URL) => {
    seen.push(input);
    const q = queues.get(input.searchParams.get("action")!) ?? ["BAD_ACTION"];
    const a = q.length > 1 ? q.shift()! : q[0];
    if (a === "TIMEOUT") throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    if (a === "NETWORK") throw new TypeError("fetch failed");
    const r = typeof a === "string" ? { status: 200, body: a } : a;
    return new Response(r.body, { status: r.status ?? 200, headers: r.headers });
  }) as unknown as typeof fetch;
  const p = new GrizzlyProvider(
    { apiUrl: "https://provider.test/stubs/handler_api.php", apiKey: "secret-key-123", maxRequestsPerSecond: opts.rps ?? 1000 },
    (l) => logs.push(l),
    fetchImpl,
    async (ms) => void sleeps.push(ms),
  );
  const calls = (action: string) => seen.filter((u) => u.searchParams.get("action") === action).length;
  return { p, logs, seen, sleeps, calls };
}

// Shapes captured from the live API (trimmed).
const LIVE = {
  countries: JSON.stringify({
    "1": { id: 1, eng: "Ukraine", rus: "Украина", visible: 1, retry: 1, rent: 0, multiService: 1 },
    "12": { id: 12, eng: "USA", visible: 1 },
    "99": { id: 99, eng: "Hidden land", visible: 0 },
  }),
  services: JSON.stringify({ services: [{ code: "wb", name: "WeChat" }, { code: "tg", name: "Telegram" }], status: "success" }),
  prices: JSON.stringify({ "12": { tg: { count: 831358, cost: 0.35, retry: 0 } }, "1": { abb: { count: 97671, cost: 0.013, retry: 0 } } }),
  v3: JSON.stringify({
    "12": {
      tg: {
        price: 0.35,
        count: 831358,
        providers: {
          "170": { count: 3875, price: [0.35], provider_id: 170 },
          "21": { count: 1714, price: [0.35], provider_id: 21 },
          "275": { count: 201, price: [0.38], provider_id: 275 },
        },
      },
    },
  }),
};

describe("amount parsing", () => {
  it("parses exactly and never under-states a cost", () => {
    expect(costToMinor("0.35")).toBe(3500);
    expect(costToMinor(0.0001)).toBe(1);
    expect(costToMinor(1.527)).toBe(15270);
    expect(costToMinor("0.00001")).toBe(1);
    expect(() => costToMinor("-1")).toThrow();
    expect(() => costToMinor("abc")).toThrow();
  });
});

describe("catalog endpoints (live shapes)", () => {
  it("reads countries with the provider's visibility flag", async () => {
    const { p } = provider({ getCountries: LIVE.countries });
    expect(await p.getCountries()).toEqual([
      { providerCode: "1", name: "Ukraine", visible: true },
      { providerCode: "12", name: "USA", visible: true },
      { providerCode: "99", name: "Hidden land", visible: false },
    ]);
  });

  it("reads services and prices", async () => {
    const { p } = provider({ getServicesList: LIVE.services, getPrices: LIVE.prices });
    expect(await p.getServices()).toEqual([
      { providerCode: "wb", name: "WeChat" },
      { providerCode: "tg", name: "Telegram" },
    ]);
    expect(await p.getPrices()).toEqual([
      { countryCode: "1", serviceCode: "abb", cost: 130, count: 97671 },
      { countryCode: "12", serviceCode: "tg", cost: 3500, count: 831358 },
    ]);
  });

  it("builds price levels from the per-supplier inventory (getPricesV3)", async () => {
    const { p, seen } = provider({ getPricesV3: LIVE.v3 });
    const inv = await p.getInventory("tg");
    expect(inv.get("12")).toEqual({
      cost: 3500,
      count: 831358,
      tiers: [
        { cost: 3500, count: 5589 },
        { cost: 3800, count: 201 },
      ],
    });
    expect(seen[0].searchParams.get("service")).toBe("tg");
    expect(seen[0].searchParams.has("country")).toBe(false);
  });

  it("treats a null inventory as nothing on sale", async () => {
    expect((await provider({ getPricesV3: "null" }).p.getInventory("zz")).size).toBe(0);
  });

  it("drops invalid rows instead of trusting them", async () => {
    const { p } = provider({
      getPrices: JSON.stringify({ "12": { tg: { cost: 0.35, count: 5 }, "bad code!": { cost: 1, count: 1 }, wa: { cost: "free", count: 2 } }, xx: {} }),
      getServicesList: JSON.stringify({ services: [{ code: "tg", name: "Telegram" }, { code: "", name: "x" }, { name: "no code" }] }),
    });
    expect(await p.getPrices()).toEqual([{ countryCode: "12", serviceCode: "tg", cost: 3500, count: 5 }]);
    expect(await p.getServices()).toHaveLength(1);
  });

  it("rejects malformed responses as INVALID_RESPONSE (never as empty inventory)", async () => {
    await expect(provider({ getPrices: "[1,2,3]" }).p.getPrices()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(provider({ getCountries: "{not json" }).p.getCountries()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(provider({ getServicesList: "{}" }).p.getServices()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("connection and errors", () => {
  it("valid credentials: reads the balance", async () => {
    expect(await provider({ getBalance: "ACCESS_BALANCE:0.0000" }).p.getBalance()).toBe(0);
    expect(await provider({ getBalance: "ACCESS_BALANCE:12.5" }).p.getBalance()).toBe(125000);
  });

  it("invalid credentials: UNAUTHORIZED, not retried, key never logged", async () => {
    const { p, logs, calls } = provider({ getBalance: "NO_KEY" });
    await expect(p.getBalance()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(calls("getBalance")).toBe(1);
    expect(JSON.stringify(logs)).not.toContain("secret-key-123");
    expect(logs[0]).toMatchObject({ success: false, errorCategory: "UNAUTHORIZED", errorCode: "NO_KEY" });
  });

  it("retries safe reads on timeouts and 5xx, then succeeds", async () => {
    const { p, calls, logs } = provider({ getBalance: ["TIMEOUT", { status: 502, body: "Bad gateway" }, "ACCESS_BALANCE:1"] });
    expect(await p.getBalance()).toBe(10000);
    expect(calls("getBalance")).toBe(3);
    expect(logs.map((l) => [l.attempt, l.success, l.errorCategory])).toEqual([
      [1, false, "TIMEOUT"],
      [2, false, "UNAVAILABLE"],
      [3, true, null],
    ]);
  });

  it("gives up after the retry budget with the last error", async () => {
    await expect(provider({ getBalance: "NETWORK" }).p.getBalance()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("honours 429 Retry-After", async () => {
    const { p, sleeps } = provider({ getBalance: [{ status: 429, body: "", headers: { "retry-after": "3" } }, "ACCESS_BALANCE:1"] });
    expect(await p.getBalance()).toBe(10000);
    expect(sleeps).toContain(3000);
  });

  it("rejects HTML error pages", async () => {
    await expect(provider({ getBalance: "<html><body>Maintenance</body></html>" }).p.getBalance()).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("never retries purchases (a retry could buy a second number)", async () => {
    const { p, calls } = provider({ getNumberV2: "TIMEOUT" });
    const err = await p.purchaseNumber({ serviceCode: "tg", countryCode: "12" }).catch((e) => e);
    expect(err).toMatchObject({ code: "TIMEOUT" });
    expect(err.ambiguous).toBe(true);
    expect(calls("getNumberV2")).toBe(1);
  });

  it("never retries status changes", async () => {
    const { p, calls } = provider({ setStatus: { status: 503, body: "" } });
    await expect(p.changeStatus("1", "cancel")).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(calls("setStatus")).toBe(1);
  });

  it("paces requests to the configured rate", async () => {
    const { p, sleeps } = provider({ getBalance: "ACCESS_BALANCE:1" }, { rps: 2 });
    await Promise.all([p.getBalance(), p.getBalance(), p.getBalance()]);
    expect(sleeps.filter((ms) => ms > 0).length).toBeGreaterThanOrEqual(2);
  });
});

describe("activations", () => {
  it("buys a number (getNumberV2 JSON) with maxPrice", async () => {
    const { p, seen } = provider({
      getNumberV2: JSON.stringify({
        activationCancel: "2026-05-07 14:03:16",
        activationCost: 0.35,
        activationEnd: "2026-05-07 14:18:16",
        activationId: 495357953,
        activationTime: "2026-05-07 13:58:16",
        canGetAnotherSms: "0",
        countryCode: "12",
        currency: 643,
        phoneNumber: "18036181752",
      }),
    });
    expect(await p.purchaseNumber({ serviceCode: "tg", countryCode: "12", maxCost: 3500 })).toEqual({
      activationId: "495357953",
      phoneNumber: "18036181752",
      cost: 3500,
      canGetAnotherSms: false,
      cancelAfterSeconds: 300,
      expiresInSeconds: 1200,
    });
    expect(seen[0].searchParams.get("maxPrice")).toBe("0.35");
  });

  it("rejects purchase answers without a valid id/number", async () => {
    await expect(provider({ getNumberV2: JSON.stringify({ activationId: 1, phoneNumber: "abc" }) }).p.purchaseNumber({ serviceCode: "tg", countryCode: "12" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    await expect(provider({ getNumberV2: "NO_NUMBERS" }).p.purchaseNumber({ serviceCode: "tg", countryCode: "12" })).rejects.toMatchObject({ code: "NO_NUMBERS" });
    await expect(provider({ getNumberV2: "NO_BALANCE" }).p.purchaseNumber({ serviceCode: "tg", countryCode: "12" })).rejects.toMatchObject({
      code: "PROVIDER_NO_BALANCE",
    });
  });

  it("maps every documented activation status", async () => {
    const cases: [string, unknown][] = [
      ["STATUS_WAIT_CODE", { state: "waiting" }],
      ["STATUS_WAIT_RESEND", { state: "waiting" }],
      ["STATUS_WAIT_RETRY:1234", { state: "waiting_retry", lastCode: "1234" }],
      ["STATUS_OK:852508", { state: "code", code: "852508" }],
      ["STATUS_CANCEL", { state: "cancelled" }],
      ["NO_ACTIVATION", { state: "not_found" }],
    ];
    for (const [answer, expected] of cases) expect(await provider({ getStatus: answer }).p.getActivationState("1")).toEqual(expected);
    await expect(provider({ getStatus: "SOMETHING_NEW" }).p.getActivationState("1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("reads SMS text, active activations, and changes status", async () => {
    const { p, seen } = provider({
      getStatusV2: JSON.stringify({ verificationType: 2, sms: { dateTime: "2026-02-26 12:05:55", code: "852508", text: "Code 852508" } }),
      getActiveActivations: JSON.stringify([
        { activationCost: 0.35, activationId: "495367092", activationStatus: 1, countryCode: "12", phoneNumber: "19568190051", serviceCode: "tg" },
        { activationId: "x", phoneNumber: "1", serviceCode: "tg", countryCode: "12" },
      ]),
      setStatus: "ACCESS_CANCEL",
    });
    expect(await p.getLatestSms("1")).toMatchObject({ code: "852508", text: "Code 852508" });
    expect(await p.getActiveActivations()).toEqual([
      { activationId: "495367092", phoneNumber: "19568190051", serviceCode: "tg", countryCode: "12", cost: 3500 },
    ]);
    await p.changeStatus("1", "cancel");
    expect(seen.at(-1)!.searchParams.get("status")).toBe("8");
    expect(await provider({ getActiveActivations: "null" }).p.getActiveActivations()).toEqual([]);
    await expect(provider({ setStatus: "EARLY_CANCEL_DENIED" }).p.changeStatus("1", "cancel")).rejects.toMatchObject({ code: "EARLY_CANCEL" });
  });
});

describe("country flags", () => {
  it("maps provider country names to ISO codes", async () => {
    const { isoForCountryName } = await import("@/server/catalog/country-iso");
    expect(isoForCountryName("United Kingdom")).toBe("gb");
    expect(isoForCountryName("Germany")).toBe("de");
    expect(isoForCountryName("Russia")).toBe("ru");
    expect(isoForCountryName("USA (virtual)")).toBe("us");
    expect(isoForCountryName("Swaziland")).toBe("sz");
    expect(isoForCountryName("Czech Republic")).toBe("cz");
    expect(isoForCountryName("Côte d'Ivoire")).toBe("ci");
    expect(isoForCountryName("Atlantis")).toBeNull();
  });
});
