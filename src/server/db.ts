import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

/**
 * Single Prisma client per process (reused across dev hot reloads).
 * Connects to MySQL/MariaDB through the official MariaDB driver adapter.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = env().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  // The MariaDB driver expects the mariadb:// scheme; mysql:// URLs are equivalent.
  const adapter = new PrismaMariaDb(url.replace(/^mysql:\/\//, "mariadb://"));
  return new PrismaClient({ adapter });
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env().DATABASE_URL);
}

/** Lazily-created client; throws if DATABASE_URL is missing. */
export function db(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

export { Prisma };

/** Prisma error code for a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
