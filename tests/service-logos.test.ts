import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ServiceAvatar } from "@/components/ui/CatalogVisuals";
import mapping from "@/config/service-logos.json";
import { GENERIC_SERVICE_ICON } from "@/lib/generic-service-icon";
import { serviceLogo } from "@/lib/service-logos";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import { getOffersForService, listServices, syncCatalog } from "@/server/services/catalog.service";
import { FakeProvider } from "./fake-provider";
import { resetDatabase } from "./helpers";

const logos = mapping.logos as Record<string, { icon: string; brand: string; from: string }>;
const categories = mapping.categories as Record<string, string>;
const svgHeader = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">';

describe("service icons", () => {
  it("every mapped code has a local SVG: brand logos with an accessible title, categories with a badge", () => {
    expect(Object.keys(logos).length).toBeGreaterThan(200);
    for (const [code, { icon, brand }] of Object.entries(logos)) {
      expect(serviceLogo(code)).toBe(`/service-logos/${icon}.svg`);
      const svg = readFileSync(`public/service-logos/${icon}.svg`, "utf8");
      expect(svg.startsWith(svgHeader), icon).toBe(true);
      expect(svg).toContain(`<title>${brand.replace(/&/g, "&amp;")} logo</title>`);
    }
    for (const [code, category] of Object.entries(categories)) {
      expect(serviceLogo(code)).toBe(`/service-logos/category-${category}.svg`);
      expect(existsSync(`public/service-logos/category-${category}.svg`), category).toBe(true);
    }
    expect(readFileSync(`public${GENERIC_SERVICE_ICON}`, "utf8").startsWith(svgHeader)).toBe(true);
  });

  it("a code is either a brand logo or a category, never both", () => {
    expect(Object.keys(logos).filter((code) => code in categories)).toEqual([]);
  });

  it("keeps the existing logos and keys on the provider code, not the display name", () => {
    const before = { wa: "whatsapp", tg: "telegram", fb: "facebook", ig: "instagram", lf: "tiktok", go: "google", ds: "discord", ub: "uber", tw: "x", fu: "snapchat", bnl: "reddit", wx: "apple", mt: "steam", ts: "paypal", aon: "binance", nf: "netflix", vi: "viber", wb: "wechat", dh: "ebay", mm: "microsoft" };
    for (const [code, icon] of Object.entries(before)) expect(serviceLogo(code)).toBe(`/service-logos/${icon}.svg`);
    expect(serviceLogo("am")).toBe("/service-logos/amazon.svg");
    expect(serviceLogo("Whatsapp")).toBe(GENERIC_SERVICE_ICON);
    expect(serviceLogo("some-new-service")).toBe(GENERIC_SERVICE_ICON);
  });

  it("never renders a first-letter avatar", () => {
    const withLogo = renderToStaticMarkup(createElement(ServiceAvatar, { name: "Zebra Pay", color: "#123456", logo: "/service-logos/category-finance.svg" }));
    const withoutLogo = renderToStaticMarkup(createElement(ServiceAvatar, { name: "Zebra Pay", color: "#123456", logo: null }));
    expect(withLogo).toMatch(/^<img [^>]*src="\/service-logos\/category-finance\.svg"/);
    expect(withoutLogo).toMatch(new RegExp(`^<img [^>]*src="${GENERIC_SERVICE_ICON}"`));
    expect(withoutLogo).not.toContain(">Z<");
  });
});

describe("service DTOs carry the icon", () => {
  beforeEach(async () => {
    await resetDatabase();
    setProviderForTesting(new FakeProvider());
    await syncCatalog();
  });
  afterEach(() => setProviderForTesting(undefined));
  afterAll(() => db().$disconnect());

  it("catalog services and offers include an icon for every service", async () => {
    await db().service.create({ data: { provider: "fake", providerCode: "zzz", slug: "zzz", name: "Brand New" } });
    const services = await listServices();
    expect(services.every((s) => typeof s.logo === "string" && s.logo.startsWith("/service-logos/"))).toBe(true);
    expect(services.find((s) => s.slug === "wa")?.logo).toBe("/service-logos/whatsapp.svg");
    const offers = await getOffersForService("tg");
    expect(offers.status === "ok" && offers.data.every((g) => g.service.logo === "/service-logos/telegram.svg")).toBe(true);
    expect(serviceLogo("zzz")).toBe(GENERIC_SERVICE_ICON);
  });
});
