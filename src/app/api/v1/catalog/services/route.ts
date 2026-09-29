import { NextResponse } from "next/server";
import { listCountries, listServices } from "@/server/services/catalog.service";

/** GET /api/v1/catalog/services — services and countries currently on sale. */
export async function GET() {
  try {
    const [services, countries] = await Promise.all([listServices(), listCountries()]);
    return NextResponse.json({ services, countries }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("[api] catalog failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Catalog unavailable." } }, { status: 503 });
  }
}
