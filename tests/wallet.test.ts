import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { toMinor } from "@/lib/money";
import { db } from "@/server/db";
import {
  adjustWallet,
  applyInTx,
  creditWallet,
  debitWallet,
  getBalance,
  getTransactionHistory,
  refundWallet,
  WalletError,
} from "@/server/services/wallet.service";
import { createUser, resetDatabase, USD } from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db().$disconnect());

const balanceOf = async (userId: string) => (await getBalance(userId)).balance;

describe("wallet basics", () => {
  it("every user has one wallet in the platform currency, starting at zero", async () => {
    const u = await createUser();
    const w = await getBalance(u.id);
    expect(w).toMatchObject({ balance: 0, currency: "USD" });
  });

  it("credits and debits with correct before/after on each ledger row", async () => {
    const u = await createUser();
    const c = await creditWallet({ userId: u.id, amount: USD(10), type: "DEPOSIT", reference: "t:dep1" });
    expect(c.entry).toMatchObject({ amount: USD(10), balanceBefore: 0, balanceAfter: USD(10), type: "DEPOSIT" });

    const d = await debitWallet({ userId: u.id, amount: USD(2), type: "PURCHASE", reference: "t:buy1" });
    expect(d.entry).toMatchObject({ amount: -USD(2), balanceBefore: USD(10), balanceAfter: USD(8) });
    expect(await balanceOf(u.id)).toBe(USD(8));

    const r = await refundWallet({ userId: u.id, amount: USD(2), reference: "t:ref1" });
    expect(r.entry).toMatchObject({ type: "REFUND", balanceAfter: USD(10) });
  });

  it("keeps sub-cent precision exactly (no floating point drift)", async () => {
    const u = await createUser();
    for (let i = 0; i < 10; i++) await creditWallet({ userId: u.id, amount: 1, type: "DEPOSIT", reference: `t:tiny${i}` });
    expect(await balanceOf(u.id)).toBe(10); // 10 × 0.0001 = 0.0010 exactly
    const row = await db().wallet.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row.balance.toString()).toBe("0.001");
  });
});

describe("amount validation", () => {
  it.each([0, -5, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER])("rejects %s", async (amount) => {
    const u = await createUser();
    await expect(creditWallet({ userId: u.id, amount, type: "DEPOSIT", reference: `t:bad${amount}` })).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });
});

describe("insufficient balance", () => {
  it("refuses a debit that would go negative and changes nothing", async () => {
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(1), type: "DEPOSIT", reference: "t:dep" });
    await expect(debitWallet({ userId: u.id, amount: USD(1.01), type: "PURCHASE", reference: "t:over" })).rejects.toBeInstanceOf(WalletError);
    expect(await balanceOf(u.id)).toBe(USD(1));
    expect(await db().transaction.count({ where: { reference: "t:over" } })).toBe(0);
  });
});

describe("idempotency", () => {
  it("the same reference is applied once, even when repeated", async () => {
    const u = await createUser();
    const a = await creditWallet({ userId: u.id, amount: USD(5), type: "DEPOSIT", reference: "t:once" });
    const b = await creditWallet({ userId: u.id, amount: USD(5), type: "DEPOSIT", reference: "t:once" });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.entry.id).toBe(a.entry.id);
    expect(await balanceOf(u.id)).toBe(USD(5));
  });

  it("concurrent duplicates still apply once", async () => {
    const u = await createUser();
    await Promise.all(
      Array.from({ length: 8 }, () => creditWallet({ userId: u.id, amount: USD(1), type: "DEPOSIT", reference: "t:race" })),
    );
    expect(await balanceOf(u.id)).toBe(USD(1));
    expect(await db().transaction.count({ where: { userId: u.id } })).toBe(1);
  });

  it("another user's reference can't be reused", async () => {
    const a = await createUser();
    const b = await createUser();
    await creditWallet({ userId: a.id, amount: USD(1), type: "DEPOSIT", reference: "t:shared" });
    await expect(creditWallet({ userId: b.id, amount: USD(1), type: "DEPOSIT", reference: "t:shared" })).rejects.toMatchObject({
      code: "REFERENCE_CONFLICT",
    });
    expect(await balanceOf(b.id)).toBe(0);
  });
});

describe("concurrency", () => {
  it("parallel debits never overspend (no double spending)", async () => {
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(10), type: "DEPOSIT", reference: "t:fund" });
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => debitWallet({ userId: u.id, amount: USD(1), type: "PURCHASE", reference: `t:p${i}` })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(10);
    expect(await balanceOf(u.id)).toBe(0);
    // The ledger replays exactly to the final balance.
    const rows = await db().transaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
    expect(rows.reduce((s, r) => s + toMinor(r.amount), 0)).toBe(0);
    for (const r of rows) expect(toMinor(r.balanceAfter)).toBe(toMinor(r.balanceBefore) + toMinor(r.amount));
  });

  it("mixed parallel credits and debits end consistent", async () => {
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(5), type: "DEPOSIT", reference: "t:start" });
    await Promise.allSettled([
      ...Array.from({ length: 10 }, (_, i) => creditWallet({ userId: u.id, amount: USD(1), type: "DEPOSIT", reference: `t:c${i}` })),
      ...Array.from({ length: 10 }, (_, i) => debitWallet({ userId: u.id, amount: USD(1), type: "PURCHASE", reference: `t:d${i}` })),
    ]);
    const sum = (await db().transaction.findMany({ where: { userId: u.id } })).reduce((s, r) => s + toMinor(r.amount), 0);
    expect(await balanceOf(u.id)).toBe(sum);
    expect(await balanceOf(u.id)).toBeGreaterThanOrEqual(0);
  });
});

describe("atomicity and database guards", () => {
  it("rolls back the balance when a later write in the same transaction fails", async () => {
    const u = await createUser();
    await creditWallet({ userId: u.id, amount: USD(3), type: "DEPOSIT", reference: "t:fund" });
    await expect(
      db().$transaction(async (tx) => {
        await applyInTx(tx, { userId: u.id, amount: USD(1), type: "PURCHASE", reference: "t:rollback" }, -1);
        throw new Error("simulated failure after debit");
      }),
    ).rejects.toThrow("simulated failure");
    expect(await balanceOf(u.id)).toBe(USD(3));
    expect(await db().transaction.count({ where: { reference: "t:rollback" } })).toBe(0);
  });

  it("the database rejects a negative balance even from raw SQL", async () => {
    const u = await createUser();
    await expect(db().$executeRaw`UPDATE wallets SET balance = -1 WHERE user_id = ${u.id}`).rejects.toThrow();
  });

  it("ledger rows can't be edited or deleted", async () => {
    const u = await createUser();
    const { entry } = await creditWallet({ userId: u.id, amount: USD(1), type: "DEPOSIT", reference: "t:immutable" });
    await expect(db().$executeRaw`UPDATE transactions SET amount = 999 WHERE id = ${entry.id}`).rejects.toThrow(/append-only/);
    await expect(db().$executeRaw`DELETE FROM transactions WHERE id = ${entry.id}`).rejects.toThrow(/append-only/);
  });

  it("adjustments record who made them and can debit", async () => {
    const u = await createUser();
    await adjustWallet({ userId: u.id, amount: USD(4), reference: "t:adj1", description: "Manual credit", actor: "test" });
    await adjustWallet({ userId: u.id, amount: -USD(1.5), reference: "t:adj2", description: "Correction", actor: "test" });
    expect(await balanceOf(u.id)).toBe(USD(2.5));
    const row = await db().transaction.findUniqueOrThrow({ where: { reference: "t:adj1" } });
    expect(row.metadata).toEqual({ actor: "test" });
  });
});

describe("history", () => {
  it("paginates newest first and filters by type, amount and date", async () => {
    const u = await createUser();
    for (let i = 1; i <= 12; i++) await creditWallet({ userId: u.id, amount: USD(i), type: "DEPOSIT", reference: `t:h${i}` });
    await debitWallet({ userId: u.id, amount: USD(3), type: "PURCHASE", reference: "t:hp" });

    const p1 = await getTransactionHistory(u.id, { page: 1, pageSize: 5 });
    expect(p1.total).toBe(13);
    expect(p1.items).toHaveLength(5);
    expect(p1.items[0].reference).toBe("t:hp");
    const p3 = await getTransactionHistory(u.id, { page: 3, pageSize: 5 });
    expect(p3.items).toHaveLength(3);

    const purchases = await getTransactionHistory(u.id, { types: ["PURCHASE"] });
    expect(purchases.items.map((i) => i.reference)).toEqual(["t:hp"]);

    const mid = await getTransactionHistory(u.id, { minAmount: USD(3), maxAmount: USD(4) });
    expect(mid.items.map((i) => i.reference).sort()).toEqual(["t:h3", "t:h4", "t:hp"]);

    const future = await getTransactionHistory(u.id, { from: new Date(Date.now() + 86_400_000) });
    expect(future.total).toBe(0);
  });

  it("only returns the requesting user's rows", async () => {
    const a = await createUser();
    const b = await createUser();
    await creditWallet({ userId: a.id, amount: USD(1), type: "DEPOSIT", reference: "t:a" });
    expect((await getTransactionHistory(b.id)).total).toBe(0);
  });
});
