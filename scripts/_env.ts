import { existsSync } from "node:fs";

// Load local env files for CLI scripts (already-set variables win).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
