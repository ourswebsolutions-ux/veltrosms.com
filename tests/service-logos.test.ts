import { existsSync, readFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import mapping from "@/config/service-logos.json";
import { serviceLogo } from "@/lib/service-logos";
import { db } from "@/server/db";
import { setProviderForTesting } from "@/server/providers/registry";
import { getOffersForService, listServices, syncCatalog } from "@/server/services/catalog.service";
import { FakeProvider } from "./fake-provider";
import { resetDatabase } from "./helpers";

describe("service logos", () => {
  it("maps 15–20 well-known services, each to an existing local SVG with an accessible title", () => {
    const entries = Object.entries(mapping as Record<string, { icon: string; brand: string }>);
    expect(entries.length).toBeGreaterThanOrEqual(15);
    expect(entries.length).toBeLessThanOrEqual(20);
    for (const [code, { icon, brand }] of entries) {
      expect(serviceLogo(code)).toBe(`/service-logos/${icon}.svg`);
      const file = `public/service-logos/${icon}.svg`;
      expect(existsSync(file), file).toBe(true);
      const svg = readFileSync(file, "utf8");
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">')).toBe(true);
      expect(svg).toContain(`<title>${brand} logo</title>`);
    }
  });

  it("keys on the provider service code, not the display name; unknown services keep the letter avatar", () => {
    expect(serviceLogo("wa")).toBe("/service-logos/whatsapp.svg");
    expect(serviceLogo("tg")).toBe("/service-logos/telegram.svg");
    expect(serviceLogo("fb")).toBe("/service-logos/facebook.svg");
    expect(serviceLogo("ig")).toBe("/service-logos/instagram.svg");
    expect(serviceLogo("Whatsapp")).toBeNull();
    expect(serviceLogo("am")).toBeNull(); // Amazon: no logo in the library → letter avatar
    expect(serviceLogo("some-new-service")).toBeNull();
  });
});

describe("service DTOs carry the logo", () => {
  beforeEach(async () => {
    await resetDatabase();
    setProviderForTesting(new FakeProvider());
    await syncCatalog();
  });
  afterEach(() => setProviderForTesting(undefined));
  afterAll(() => db().$disconnect());

  it("catalog services and offers include the logo for mapped codes only", async () => {
    await db().service.create({ data: { provider: "fake", providerCode: "zzz", slug: "zzz", name: "Brand New" } });
    const services = await listServices();
    expect(services.find((s) => s.slug === "wa")?.logo).toBe("/service-logos/whatsapp.svg");
    expect(services.find((s) => s.slug === "tg")?.logo).toBe("/service-logos/telegram.svg");
    const offers = await getOffersForService("tg");
    expect(offers.status === "ok" && offers.data.every((g) => g.service.logo === "/service-logos/telegram.svg")).toBe(true);
    const unknown = await db().service.findFirstOrThrow({ where: { providerCode: "zzz" } });
    expect(serviceLogo(unknown.providerCode)).toBeNull();
  });
});
