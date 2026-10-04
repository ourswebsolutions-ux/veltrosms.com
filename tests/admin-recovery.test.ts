import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminRecoverySchema } from "@/lib/validation/recovery";
import { recoverAdmin, recoverySecretMatches } from "@/server/admin/recovery";
import { adminRecoveryAction } from "@/server/actions/recovery";
import { validateSessionToken } from "@/server/auth/session";
import { db } from "@/server/db";
import { resetEnvCache } from "@/server/env";
import { createApiKey, userForApiKey } from "@/server/services/api-key.service";
import * as auth from "@/server/services/auth.service";
import { resetDatabase } from "./helpers";

// The server action reads the client IP from request headers.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const SECRET = "test-recovery-secret-".padEnd(80, "x0");
const ctx = { ip: "unknown", userAgent: "vitest" };
const OLD = { email: "owner@example.com", password: "old-admin-pass-42" };
const OLD2 = { email: "second-admin@example.com", password: "second-admin-pass-9" };
const NEW = { email: "new-owner@example.com", password: "brand-new-pass-77" };
const USER = { email: "user@example.com", password: "user-password-55" };

function configure(secret: string | undefined, ips?: string) {
  if (secret === undefined) delete process.env.ADMIN_RECOVERY_SECRET;
  else process.env.ADMIN_RECOVERY_SECRET = secret;
  if (ips === undefined) delete process.env.ADMIN_RECOVERY_ALLOWED_IPS;
  else process.env.ADMIN_RECOVERY_ALLOWED_IPS = ips;
  resetEnvCache();
}

async function createAccount({ email, password }: { email: string; password: string }, role: "ADMIN" | "USER") {
  const r = await auth.register({ name: "Some Person", email, password }, ctx);
  if (!r.ok) throw new Error("register failed");
  return db().user.update({ where: { email }, data: { role }, include: { wallet: true } });
}

const login = (email: string, password: string) => auth.login({ email, password, remember: false }, ctx);
const recover = (email = NEW.email, password = NEW.password, secret = SECRET, c = ctx) => recoverAdmin({ secret, email, password }, c);
const adminEmails = async () => (await db().user.findMany({ where: { role: "ADMIN" }, orderBy: { email: "asc" } })).map((a) => a.email);

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(async () => {
  await resetDatabase();
  configure(SECRET);
});

afterAll(async () => {
  configure(undefined);
  await db().$disconnect();
});

describe("emergency admin recovery", () => {
  it("refuses an incorrect secret and changes nothing", async () => {
    await createAccount(OLD, "ADMIN");
    expect(await recover(NEW.email, NEW.password, "wrong-secret")).toEqual({ ok: false, code: "denied" });
    expect(await recover(NEW.email, NEW.password, SECRET.slice(0, -1))).toEqual({ ok: false, code: "denied" });
    expect(await adminEmails()).toEqual([OLD.email]);
    expect((await login(OLD.email, OLD.password)).ok).toBe(true);
  });

  it("is off when the secret is unset or shorter than 64 characters", async () => {
    await createAccount(OLD, "ADMIN");
    configure(undefined);
    expect(recoverySecretMatches("")).toBe(false);
    configure("short-secret");
    expect(recoverySecretMatches("short-secret")).toBe(false);
    expect(await recover(NEW.email, NEW.password, "short-secret")).toEqual({ ok: false, code: "denied" });
    expect(await adminEmails()).toEqual([OLD.email]);
  });

  it("with the correct secret makes the submitted email the only admin and revokes every old admin", async () => {
    const oldAdmin = await createAccount(OLD, "ADMIN");
    const oldAdmin2 = await createAccount(OLD2, "ADMIN");
    const user = await createAccount(USER, "USER");
    await db().wallet.update({ where: { userId: user.id }, data: { balance: "12.5" } });
    await db().wallet.update({ where: { userId: oldAdmin.id }, data: { balance: "3" } });
    const userBefore = await db().user.findUniqueOrThrow({ where: { id: user.id }, include: { wallet: true } });

    const adminSession = await login(OLD.email, OLD.password);
    const userSession = await login(USER.email, USER.password);
    if (!adminSession.ok || !userSession.ok) throw new Error("login failed");
    const { key: oldApiKey } = await createApiKey(oldAdmin.id);
    expect(await userForApiKey(oldApiKey)).not.toBeNull();

    expect(await recover()).toEqual({ ok: true, email: NEW.email, replaced: 2 });

    expect(await adminEmails()).toEqual([NEW.email]);
    for (const id of [oldAdmin.id, oldAdmin2.id]) {
      expect(await db().user.findUniqueOrThrow({ where: { id } })).toMatchObject({ role: "USER", status: "SUSPENDED" });
    }
    // Old admin data is kept, not deleted.
    expect((await db().wallet.findUniqueOrThrow({ where: { userId: oldAdmin.id } })).balance.toString()).toBe("3");

    // Sessions and API access revoked; old credentials no longer work.
    expect(await validateSessionToken(adminSession.session.token)).toBeNull();
    expect(await db().session.count({ where: { userId: { in: [oldAdmin.id, oldAdmin2.id] } } })).toBe(0);
    expect(await userForApiKey(oldApiKey)).toBeNull();
    expect((await login(OLD.email, OLD.password)).ok).toBe(false);
    expect((await login(OLD2.email, OLD2.password)).ok).toBe(false);

    const fresh = await login(NEW.email, NEW.password);
    expect(fresh.ok).toBe(true);
    if (fresh.ok) expect((await validateSessionToken(fresh.session.token))?.role).toBe("admin");

    // The normal user is untouched: account, wallet, session, login.
    expect(await db().user.findUniqueOrThrow({ where: { id: user.id }, include: { wallet: true } })).toEqual(userBefore);
    expect((await validateSessionToken(userSession.session.token))?.id).toBe(user.id);
    expect((await login(USER.email, USER.password)).ok).toBe(true);
  });

  it("can be used again later with the same secret", async () => {
    await createAccount(OLD, "ADMIN");
    expect((await recover()).ok).toBe(true);
    expect((await recover("third-owner@example.com", "third-owner-pass-8")).ok).toBe(true);
    expect(await adminEmails()).toEqual(["third-owner@example.com"]);
    expect((await login(NEW.email, NEW.password)).ok).toBe(false);
  });

  it("keeps an existing admin's account when its email is submitted, with the new password", async () => {
    const oldAdmin = await createAccount(OLD, "ADMIN");
    await createAccount(OLD2, "ADMIN");
    expect(await recover(OLD.email, NEW.password)).toMatchObject({ ok: true, replaced: 1 });
    expect((await db().user.findMany({ where: { role: "ADMIN" } })).map((a) => a.id)).toEqual([oldAdmin.id]);
    expect((await login(OLD.email, OLD.password)).ok).toBe(false);
    expect((await login(OLD.email, NEW.password)).ok).toBe(true);
  });

  it("refuses a normal customer's email, even with the correct secret, and changes nothing", async () => {
    await createAccount(OLD, "ADMIN");
    const user = await createAccount(USER, "USER");
    expect(await recover(USER.email)).toEqual({ ok: false, code: "denied" });
    expect((await db().user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("USER");
    expect(await adminEmails()).toEqual([OLD.email]);
    expect((await login(USER.email, USER.password)).ok).toBe(true);
  });

  it("gives the same answer for a wrong secret and a customer email", async () => {
    await createAccount(OLD, "ADMIN");
    await createAccount(USER, "USER");
    const wrongSecret = await adminRecoveryAction({ status: "idle" }, form({ recoveryToken: "wrong", email: NEW.email, password: NEW.password, confirm: NEW.password }));
    const customer = await adminRecoveryAction({ status: "idle" }, form({ recoveryToken: SECRET, email: USER.email, password: NEW.password, confirm: NEW.password }));
    expect(wrongSecret.status).toBe("error");
    expect({ ...wrongSecret, values: undefined }).toEqual({ ...customer, values: undefined });
  });

  it("never returns the secret or password to the client", async () => {
    await createAccount(OLD, "ADMIN");
    const responses = [
      await adminRecoveryAction({ status: "idle" }, form({ recoveryToken: SECRET, email: "bad", password: NEW.password, confirm: NEW.password })),
      await adminRecoveryAction({ status: "idle" }, form({ recoveryToken: SECRET.slice(1), email: NEW.email, password: NEW.password, confirm: NEW.password })),
      await adminRecoveryAction({ status: "idle" }, form({ recoveryToken: SECRET, email: NEW.email, password: NEW.password, confirm: NEW.password })),
    ];
    expect(responses[2].status).toBe("success");
    for (const r of responses) {
      const json = JSON.stringify(r);
      expect(json).not.toContain(SECRET.slice(0, 30));
      expect(json).not.toContain(NEW.password);
    }
  });

  it("keeps the secret out of client-side source", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push(p);
      }
    };
    walk(path.resolve(import.meta.dirname, "../src"));
    const clientFiles = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const f of clientFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toContain("ADMIN_RECOVERY_SECRET");
      expect(src, f).not.toMatch(/from ["']@\/server\/(env|admin\/recovery)["']/);
    }
  });

  it("never records the secret or passwords in the audit log", async () => {
    await createAccount(OLD, "ADMIN");
    await recover(NEW.email, NEW.password, "wrong-secret-attempt");
    await recover();
    const rows = await db().auditLog.findMany({ where: { action: "admin.recovery" } });
    expect(rows.map((r) => r.success).sort()).toEqual([false, true]);
    const dump = JSON.stringify(rows.map((r) => ({ d: r.description, m: r.metadata, t: r.targetId })));
    for (const secret of [SECRET.slice(0, 30), "wrong-secret-attempt", NEW.password, OLD.password]) expect(dump).not.toContain(secret);
  });

  it("rate limits attempts before checking the secret", async () => {
    await createAccount(OLD, "ADMIN");
    const ipCtx = { ip: "203.0.113.9", userAgent: "vitest" };
    for (let i = 0; i < 5; i++) expect((await recover(NEW.email, NEW.password, "guess", ipCtx)).ok).toBe(false);
    expect(await recover(NEW.email, NEW.password, SECRET, ipCtx)).toMatchObject({ ok: false, code: "rate_limited" });
    expect(await adminEmails()).toEqual([OLD.email]);
  });

  it("honours the optional IP allowlist", async () => {
    await createAccount(OLD, "ADMIN");
    configure(SECRET, "198.51.100.7");
    expect(await recover(NEW.email, NEW.password, SECRET, { ip: "203.0.113.9", userAgent: "vitest" })).toEqual({ ok: false, code: "denied" });
    expect((await recover(NEW.email, NEW.password, SECRET, { ip: "198.51.100.7", userAgent: "vitest" })).ok).toBe(true);
  });

  it("validates the secret, email and password fields", () => {
    const ok = { recoveryToken: SECRET, email: NEW.email, password: NEW.password, confirm: NEW.password };
    expect(adminRecoverySchema.safeParse(ok).success).toBe(true);
    expect(adminRecoverySchema.safeParse({ ...ok, recoveryToken: "" }).success).toBe(false);
    expect(adminRecoverySchema.safeParse({ ...ok, email: "not-an-email" }).success).toBe(false);
    expect(adminRecoverySchema.safeParse({ ...ok, password: "short1", confirm: "short1" }).success).toBe(false);
    expect(adminRecoverySchema.safeParse({ ...ok, confirm: "different-pass-1" }).success).toBe(false);
  });
});
