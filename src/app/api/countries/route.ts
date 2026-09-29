import { NextResponse } from "next/server";
import { listCountries } from "@/server/services/catalog.service";

/** GET /api/countries — countries currently on sale (normalized; no provider codes). */
export async function GET() {
  try {
    return NextResponse.json({ countries: await listCountries() }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("[api] countries failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Catalog unavailable." } }, { status: 503 });
  }
}
