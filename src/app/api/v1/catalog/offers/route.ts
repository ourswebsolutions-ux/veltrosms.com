import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOffersForCountry, getOffersForService } from "@/server/services/catalog.service";

const query = z.union([
  z.object({ service: z.string().min(1).max(64), country: z.undefined() }),
  z.object({ country: z.string().regex(/^\d{1,10}$/), service: z.undefined() }),
]);

/**
 * GET /api/v1/catalog/offers?service=<slug>   — prices per country for a service
 * GET /api/v1/catalog/offers?country=<id>     — prices per service in a country
 * Public and read-only; prices are customer prices in minor units (1/10,000).
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const parsed = query.safeParse({ service: p.get("service") ?? undefined, country: p.get("country") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID", message: "Provide exactly one of `service` or `country`." } }, { status: 400 });
  }
  const result = parsed.data.service ? await getOffersForService(parsed.data.service) : await getOffersForCountry(parsed.data.country!);
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}
