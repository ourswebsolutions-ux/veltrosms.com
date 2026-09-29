import { NextResponse } from "next/server";
import { listServices } from "@/server/services/catalog.service";

/** GET /api/services — services currently on sale (normalized; no provider codes). */
export async function GET() {
  try {
    return NextResponse.json({ services: await listServices() }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("[api] services failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Catalog unavailable." } }, { status: 503 });
  }
}
