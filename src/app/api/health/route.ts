import { NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@/server/db";
import { getProvider } from "@/server/providers/registry";
import { getCatalogStatus } from "@/server/services/catalog.service";

export const dynamic = "force-dynamic";

/** Liveness/config probe for deploys. Reports status, never secrets. */
export async function GET() {
  let database: "ok" | "error" | "not_configured" = "not_configured";
  if (isDatabaseConfigured()) {
    database = await db()
      .$queryRaw`SELECT 1`.then(() => "ok" as const)
      .catch(() => "error" as const);
  }
  const catalog = database === "ok" ? await getCatalogStatus().catch(() => null) : null;
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database, provider: getProvider().id, catalogSyncedAt: catalog?.lastSuccessAt ?? null },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
