import { execSync } from "node:child_process";

/** Applies migrations to the test database once before the run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "mysql://root:root@127.0.0.1:3306/rocksms_test";
  if (!/rocksms_test|_test\b/.test(url)) throw new Error("Refusing to run tests against a non-test database.");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
