import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Load local env files for CLI commands (Next.js loads them itself at runtime).
// Variables already set in the environment take precedence.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
