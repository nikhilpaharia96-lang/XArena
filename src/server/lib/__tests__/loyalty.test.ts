import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { awardForDeposit, loyaltySummary } from "../loyalty";
import { LEVELS, MONTHLY_TARGETS, istMonth, levelIndexForXp } from "@/lib/loyalty";

let db: Database.Database;
let u: Seed;
let n = 0;
const NOW = "2026-11-26T05:00:00.000Z";

/** Records a completed deposit the way the real paths do, then runs the reward hook. */
function deposit(paise: number, at = NOW) {
  db.prepare(`INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, createdAt) VALUES (?, ?, 'DEPOSIT', 'COMPLETED', ?, 0, ?, ?)`).run(
    `t${++n}`, u.userId, paise, `ref-${n}`, at
  );
  db.prepare("UPDATE Wallet SET depositBalance = depositBalance + ? WHERE userId = ?").run(paise, u.userId);
  awardForDeposit(db, u.userId, paise, at);
}
const bonus = () => walletOf(db, u.userId).bonus;
const rewards = () => db.prepare("SELECT kind, rewardKey, amount FROM LoyaltyReward WHERE userId = ? ORDER BY createdAt, rewardKey").all(u.userId) as { kind: string; rewardKey: string; amount: number }[];

beforeEach(() => {
  db = makeDb();
  u = seedUser(db, { deposit: 0 });
});

describe("loyalty tables", () => {
  it("levels ascend and map XP to the right level", () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].minXp).toBeGreaterThan(LEVELS[i - 1].minXp);
    expect(levelIndexForXp(0)).toBe(0);
    expect(levelIndexForXp(1_999)).toBe(0);
    expect(levelIndexForXp(2_000)).toBe(1);
    expect(levelIndexForXp(10_000_000)).toBe(LEVELS.length - 1);
  });
  it("month is the India calendar month (UTC+5:30)", () => {
    expect(istMonth(new Date("2026-11-30T19:00:00Z")).key).toBe("2026-12"); // 00:30 IST on 1 Dec
    expect(istMonth(new Date("2026-11-30T18:00:00Z")).key).toBe("2026-11"); // 23:30 IST on 30 Nov
  });
});

describe("level-up rebate", () => {
  it("a small deposit pays nothing, and shows XP progress", () => {
    deposit(50_000); // Rs 500
    expect(bonus()).toBe(0);
    const s = loyaltySummary(db, u.userId, new Date(NOW));
    expect(s.xp).toBe(500);
    expect(s.level.name).toBe("Bronze I");
    expect(s.next?.xpToNext).toBe(1_500);
  });

  it("crossing Bronze II pays its rebate once, to the bonus wallet, with a ledger row and notification", () => {
    deposit(150_000);
    deposit(60_000); // total Rs 2,100 -> Bronze II
    const lvl = rewards().filter((r) => r.kind === "LEVEL");
    expect(lvl).toEqual([{ kind: "LEVEL", rewardKey: "1", amount: LEVELS[1].rewardPaise }]);
    // Rs 2,100 in one month also reaches the first monthly target (Rs 2,000), which pays separately.
    expect(bonus()).toBe(LEVELS[1].rewardPaise + MONTHLY_TARGETS[0].rewardPaise);
    const txn = db.prepare(`SELECT type, amount, status FROM "Transaction" WHERE userId = ? AND type = 'BONUS_CREDIT' AND description LIKE 'Level up%'`).all(u.userId);
    expect(txn).toEqual([{ type: "BONUS_CREDIT", amount: LEVELS[1].rewardPaise, status: "COMPLETED" }]);
    expect(db.prepare("SELECT COUNT(*) c FROM Notification WHERE userId = ? AND type = 'LEVEL_UP'").get(u.userId)).toEqual({ c: 1 });
    deposit(10_000); // stays in Bronze II: no second payout
    expect(rewards().filter((r) => r.kind === "LEVEL")).toHaveLength(1);
  });

  it("one big deposit pays every level it jumps over", () => {
    deposit(1_200_000); // Rs 12,000 -> Silver I (crosses Bronze II, Bronze III, Silver I)
    const keys = rewards().filter((r) => r.kind === "LEVEL").map((r) => r.rewardKey);
    expect(keys).toEqual(["1", "2", "3"]);
  });

  it("replaying the same hook never double-pays", () => {
    deposit(300_000);
    const before = bonus();
    awardForDeposit(db, u.userId, 300_000, NOW);
    expect(bonus()).toBe(before);
  });

  it("deposits made before the feature earn XP but no back-pay", () => {
    db.prepare(`INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, createdAt) VALUES ('old', ?, 'DEPOSIT', 'COMPLETED', 300000, 0, 'old-1', '2026-10-01T00:00:00Z')`).run(u.userId);
    expect(loyaltySummary(db, u.userId, new Date(NOW)).level.name).toBe("Bronze II");
    expect(bonus()).toBe(0);
    deposit(250_000); // Rs 5,500 total -> crosses Bronze III only
    expect(rewards().filter((r) => r.kind === "LEVEL").map((r) => r.rewardKey)).toEqual(["2"]);
  });
});

describe("monthly target", () => {
  it("pays each target once per month and resets next month", () => {
    deposit(200_000); // Rs 2,000 in Nov: hits target 1 (and Bronze II)
    expect(rewards().filter((r) => r.kind === "MONTH")).toHaveLength(1);
    deposit(900_000); // Rs 11,000 in Nov: hits target 2
    expect(rewards().filter((r) => r.kind === "MONTH")).toHaveLength(2);
    const s = loyaltySummary(db, u.userId, new Date(NOW));
    expect(s.month.depositedPaise).toBe(1_100_000);
    expect(s.month.next?.targetPaise).toBe(MONTHLY_TARGETS[2].targetPaise);

    const dec = "2026-12-05T05:00:00.000Z";
    deposit(200_000, dec); // new month: target 1 pays again with a new key
    expect(rewards().filter((r) => r.kind === "MONTH" && r.rewardKey.startsWith("2026-12"))).toHaveLength(1);
    expect(loyaltySummary(db, u.userId, new Date(dec)).month.depositedPaise).toBe(200_000);
  });

  it("failure inside rewards never breaks the deposit", () => {
    db.exec("DROP TABLE LoyaltyReward");
    expect(() => deposit(500_000)).not.toThrow();
    expect(walletOf(db, u.userId).deposit).toBe(500_000);
  });
});
