import { describe, expect, it } from "vitest";
import { allocateProRata, createProviderWallet, WalletError } from "../provider-wallet";
import { makeDb, seedUser, tempDbFile, walletOf } from "./helpers";

const base = { provider: "astech", currency: "INR", roundFinished: true };

describe("provider wallet — accounting policy", () => {
  it("losing bet debits bonus -> deposit -> winning (same order as tournament entry)", () => {
    const db = makeDb();
    const u = seedUser(db, { bonus: 300, deposit: 500, winning: 700 });
    const w = createProviderWallet(db);
    const r = w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 1000, winPaise: 0 });
    expect(r).toEqual({ outcome: "APPLIED", balancePaise: 500 });
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 0, deposit: 0, winning: 500 });
  });

  it("break-even round does NOT turn deposit money into withdrawable winnings", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 1000, winPaise: 1000 });
    expect(walletOf(db, u.userId)).toMatchObject({ deposit: 1000, winning: 0, bonus: 0 });
  });

  it("only PROFIT lands in winningBalance; stake returns to its source buckets", () => {
    const db = makeDb();
    const u = seedUser(db, { bonus: 200, deposit: 800 });
    const w = createProviderWallet(db);
    // bet 1000 (200 bonus + 800 deposit), win 3500 => stake 1000 back pro rata, profit 2500 -> winning
    const r = w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 1000, winPaise: 3500 });
    expect(r.balancePaise).toBe(3500);
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 200, deposit: 800, winning: 2500 });
  });

  it("partial win returns only part of the stake, pro rata", () => {
    const db = makeDb();
    const u = seedUser(db, { bonus: 500, deposit: 500 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 1000, winPaise: 400 });
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 200, deposit: 200, winning: 0 });
  });

  it("total always equals balance - bet + win (provider's win-bet math)", () => {
    const db = makeDb();
    const u = seedUser(db, { bonus: 33, deposit: 777, winning: 190 });
    const w = createProviderWallet(db);
    const r = w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 501, winPaise: 1234 });
    expect(r.balancePaise).toBe(1000 - 501 + 1234);
    const row = walletOf(db, u.userId);
    expect(row.bonus + row.deposit + row.winning).toBe(r.balancePaise);
  });

  it("lockedBalance (pending withdrawals) is never spendable", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 100, locked: 5000 });
    const w = createProviderWallet(db);
    expect(w.getBalance(u.userId)).toBe(100);
    expect(() => w.applyRound({ ...base, providerTransactionId: "t1", userId: u.userId, betPaise: 101, winPaise: 0 })).toThrowError(
      expect.objectContaining({ code: "INSUFFICIENT_FUNDS" })
    );
  });

  it("writes ledger rows in the existing Transaction table with consistent balanceAfter", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    createProviderWallet(db).applyRound({ ...base, providerTransactionId: "tx9", userId: u.userId, betPaise: 400, winPaise: 900 });
    const rows = db.prepare(`SELECT type, amount, balanceAfter, referenceId, status FROM "Transaction" ORDER BY type`).all() as Record<string, unknown>[];
    expect(rows).toEqual([
      { type: "GAME_BET", amount: 400, balanceAfter: 600, referenceId: "ASTECH-tx9-BET", status: "COMPLETED" },
      { type: "GAME_WIN", amount: 900, balanceAfter: 1500, referenceId: "ASTECH-tx9-WIN", status: "COMPLETED" },
    ]);
  });

  it("rejects invalid amounts", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    for (const bad of [-1, 1.5, Number.NaN, Infinity, 1e15]) {
      expect(() => w.applyRound({ ...base, providerTransactionId: `x${bad}`, userId: u.userId, betPaise: bad, winPaise: 0 })).toThrowError(
        expect.objectContaining({ code: "INVALID_AMOUNT" })
      );
    }
    expect(walletOf(db, u.userId).deposit).toBe(1000);
  });

  it("allocateProRata always sums exactly", () => {
    for (let n = 0; n < 200; n++) {
      const w = { bonus: (n * 7) % 13, deposit: (n * 11) % 17 + 1, winning: (n * 5) % 19 };
      const amount = (n * 3) % (w.bonus + w.deposit + w.winning + 1);
      const a = allocateProRata(amount, w);
      expect(a.bonus + a.deposit + a.winning).toBe(amount);
      expect(a.bonus).toBeLessThanOrEqual(w.bonus);
    }
  });
});

describe("provider wallet — idempotency & atomicity", () => {
  it("duplicate transaction_id returns the stored balance and never re-applies", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    const first = w.applyRound({ ...base, providerTransactionId: "dup", userId: u.userId, betPaise: 300, winPaise: 0 });
    const second = w.applyRound({ ...base, providerTransactionId: "dup", userId: u.userId, betPaise: 300, winPaise: 0 });
    const third = w.applyRound({ ...base, providerTransactionId: "dup", userId: u.userId, betPaise: 300, winPaise: 0 });
    expect(first.outcome).toBe("APPLIED");
    expect(second).toEqual({ outcome: "DUPLICATE", balancePaise: 700 });
    expect(third.balancePaise).toBe(700);
    expect(walletOf(db, u.userId).deposit).toBe(700);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get()).toEqual({ c: 1 });
    expect(db.prepare(`SELECT COUNT(*) c FROM "Transaction"`).get()).toEqual({ c: 1 });
  });

  it("a duplicate returns the ORIGINAL balance even after later activity", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "a", userId: u.userId, betPaise: 100, winPaise: 0 });
    w.applyRound({ ...base, providerTransactionId: "b", userId: u.userId, betPaise: 100, winPaise: 0 });
    expect(w.applyRound({ ...base, providerTransactionId: "a", userId: u.userId, betPaise: 100, winPaise: 0 }).balancePaise).toBe(900);
  });

  it("same transaction_id with a different payload is refused, not guessed", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "c", userId: u.userId, betPaise: 100, winPaise: 0 });
    expect(() => w.applyRound({ ...base, providerTransactionId: "c", userId: u.userId, betPaise: 999, winPaise: 0 })).toThrowError(
      expect.objectContaining({ code: "TRANSACTION_CONFLICT" })
    );
    expect(walletOf(db, u.userId).deposit).toBe(900);
  });

  it("insufficient funds changes nothing (no wallet, ledger or provider rows)", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 100 });
    const w = createProviderWallet(db);
    expect(() => w.applyRound({ ...base, providerTransactionId: "f", userId: u.userId, betPaise: 101, winPaise: 5000 })).toThrowError(WalletError);
    expect(walletOf(db, u.userId).deposit).toBe(100);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get()).toEqual({ c: 0 });
    expect(db.prepare(`SELECT COUNT(*) c FROM "Transaction"`).get()).toEqual({ c: 0 });
  });

  it("a failure midway rolls the whole unit back (atomicity)", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    // Pre-occupy the ledger reference so the INSERT after the wallet UPDATE fails.
    db.prepare(`INSERT INTO "Transaction" (id,userId,type,status,amount,balanceAfter,referenceId,createdAt) VALUES ('z',?,'X','COMPLETED',1,1,'ASTECH-boom-BET',?)`).run(u.userId, new Date().toISOString());
    const w = createProviderWallet(db);
    expect(() => w.applyRound({ ...base, providerTransactionId: "boom", userId: u.userId, betPaise: 400, winPaise: 0 })).toThrow();
    expect(walletOf(db, u.userId).deposit).toBe(1000);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get()).toEqual({ c: 0 });
  });

  it("two connections racing on one wallet cannot overdraw it", () => {
    const file = tempDbFile();
    const a = makeDb(file);
    const u = seedUser(a, { deposit: 100 });
    const b = makeDb(file);
    const wa = createProviderWallet(a);
    const wb = createProviderWallet(b);
    const r1 = wa.applyRound({ ...base, providerTransactionId: "r1", userId: u.userId, betPaise: 60, winPaise: 0 });
    expect(r1.balancePaise).toBe(40);
    expect(() => wb.applyRound({ ...base, providerTransactionId: "r2", userId: u.userId, betPaise: 60, winPaise: 0 })).toThrowError(
      expect.objectContaining({ code: "INSUFFICIENT_FUNDS" })
    );
    expect(walletOf(a, u.userId).deposit).toBe(40);
  });

  it("the same transaction arriving on two connections applies exactly once", () => {
    const file = tempDbFile();
    const a = makeDb(file);
    const u = seedUser(a, { deposit: 1000 });
    const b = makeDb(file);
    const out = [
      createProviderWallet(a).applyRound({ ...base, providerTransactionId: "same", userId: u.userId, betPaise: 250, winPaise: 0 }),
      createProviderWallet(b).applyRound({ ...base, providerTransactionId: "same", userId: u.userId, betPaise: 250, winPaise: 0 }),
    ];
    expect(out.map((o) => o.outcome)).toEqual(["APPLIED", "DUPLICATE"]);
    expect(walletOf(a, u.userId).deposit).toBe(750);
  });

  it("the DB itself enforces uniqueness of provider transaction ids", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 10 });
    const ins = () =>
      db.prepare(`INSERT INTO ProviderTransaction (id,provider,providerTransactionId,userId,currency,status,createdAt) VALUES (?, 'astech','dupe',?, 'INR','APPLIED',?)`).run(Math.random().toString(), u.userId, "t");
    ins();
    expect(ins).toThrow(/UNIQUE constraint failed/);
  });
});

describe("provider wallet — rollback", () => {
  it("restores exactly the buckets the bet came from and reverses the win", () => {
    const db = makeDb();
    const u = seedUser(db, { bonus: 200, deposit: 800, winning: 50 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "r", userId: u.userId, betPaise: 1000, winPaise: 3500 });
    const rb = w.rollback({ provider: "astech", providerTransactionId: "r", userId: u.userId, currency: "INR" });
    expect(rb).toMatchObject({ outcome: "ROLLED_BACK", balancePaise: 1050, unrecoveredPaise: 0 });
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 200, deposit: 800, winning: 50 });
  });

  it("is idempotent", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "r", userId: u.userId, betPaise: 400, winPaise: 0 });
    const input = { provider: "astech", providerTransactionId: "r", userId: u.userId, currency: "INR" };
    expect(w.rollback(input).outcome).toBe("ROLLED_BACK");
    expect(w.rollback(input).outcome).toBe("DUPLICATE");
    expect(walletOf(db, u.userId).deposit).toBe(1000);
  });

  it("unknown transaction succeeds with the current balance (documented) and blocks a late original", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 1000 });
    const w = createProviderWallet(db);
    const rb = w.rollback({ provider: "astech", providerTransactionId: "ghost", userId: u.userId, currency: "INR" });
    expect(rb).toMatchObject({ outcome: "TOMBSTONED", balancePaise: 1000 });
    const late = w.applyRound({ ...base, providerTransactionId: "ghost", userId: u.userId, betPaise: 500, winPaise: 0 });
    expect(late).toEqual({ outcome: "IGNORED_ROLLED_BACK", balancePaise: 1000 });
    expect(walletOf(db, u.userId).deposit).toBe(1000);
  });

  it("never drives a bucket negative if the player already spent the win; reports the shortfall", () => {
    const db = makeDb();
    const u = seedUser(db, { deposit: 100 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "r", userId: u.userId, betPaise: 100, winPaise: 1100 }); // profit 1000 -> winning
    db.prepare("UPDATE Wallet SET winningBalance = 0 WHERE userId = ?").run(u.userId); // player withdrew it
    const rb = w.rollback({ provider: "astech", providerTransactionId: "r", userId: u.userId, currency: "INR" });
    expect(rb.unrecoveredPaise).toBe(1000);
    const row = walletOf(db, u.userId);
    expect(row.winning).toBe(0);
    expect(row.deposit).toBeGreaterThanOrEqual(0);
  });

  it("refuses a rollback for a different user's transaction", () => {
    const db = makeDb();
    const u1 = seedUser(db, { deposit: 1000, n: 1 });
    const u2 = seedUser(db, { deposit: 1000, n: 2 });
    const w = createProviderWallet(db);
    w.applyRound({ ...base, providerTransactionId: "r", userId: u1.userId, betPaise: 100, winPaise: 0 });
    expect(() => w.rollback({ provider: "astech", providerTransactionId: "r", userId: u2.userId, currency: "INR" })).toThrowError(
      expect.objectContaining({ code: "TRANSACTION_CONFLICT" })
    );
  });
});
