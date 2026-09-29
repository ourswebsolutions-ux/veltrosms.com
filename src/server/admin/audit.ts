import "server-only";
import { db, type Prisma } from "@/server/db";
import type { AdminActor } from "./guard";

/** Keys that must never reach the audit trail, at any depth. */
const SECRET_KEY = /pass(word)?|secret|token|api_?key|authorization|cookie/i;

function scrub(value: unknown, depth = 0): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 300);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 3) return null;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1)) as Prisma.InputJsonValue;
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !SECRET_KEY.test(k))
        .map(([k, v]) => [k, scrub(v, depth + 1)]),
    ) as Prisma.InputJsonValue;
  }
  return null;
}

export type AuditEntry = {
  action: string;
  target: { type: string; id: string } | null;
  success: boolean;
  /** Human-readable summary shown in the audit log. */
  description?: string;
  metadata?: Record<string, unknown>;
};

function row(actor: AdminActor | null, e: AuditEntry): Prisma.AuditLogCreateInput {
  return {
    actorId: actor?.id ?? null,
    actorEmail: actor?.email ?? null,
    action: e.action.slice(0, 64),
    targetType: e.target?.type.slice(0, 32) ?? null,
    targetId: e.target?.id.slice(0, 64) ?? null,
    description: e.description?.slice(0, 255) ?? null,
    success: e.success,
    metadata: e.metadata ? (scrub(e.metadata) as Prisma.InputJsonValue) : undefined,
    ip: actor?.ip && actor.ip !== "unknown" ? actor.ip.slice(0, 64) : null,
  };
}

/**
 * Records a sensitive admin action and whether it succeeded. The table is
 * append-only (database triggers). Never throws: a logging failure is
 * reported but doesn't undo the action. Financial actions use auditInTx so
 * the record commits (or rolls back) together with the money movement.
 */
export async function audit(
  actor: AdminActor | null,
  action: string,
  target: { type: string; id: string } | null,
  success: boolean,
  metadata?: Record<string, unknown>,
  description?: string,
): Promise<void> {
  try {
    await db().auditLog.create({ data: row(actor, { action, target, success, metadata, description }) });
  } catch (error) {
    console.error("[audit] write failed:", error instanceof Error ? error.message : "unknown error");
  }
}

/** Audit row written inside an existing database transaction (atomic with the change it records). */
export async function auditInTx(tx: Prisma.TransactionClient, actor: AdminActor | null, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({ data: row(actor, entry) });
}
