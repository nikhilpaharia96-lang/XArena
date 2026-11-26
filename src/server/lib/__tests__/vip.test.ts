import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { settleVipRewards, vipSummary, wageredTotal } from "../vip";
import { VIP_LEVELS, expFromPaise, istMonth, levelForExp } from "@/lib/vip";

let db: Database.Database;
let u: Seed;
let n = 0;

const NOV = "2026-11-10T08:00:00.000Z";
const BEFORE_DUE = new Date("2026-11-30T20:00:00.000Z"); // 01:30 IST on 1 Dec: not yet 2:00 AM
const AFTER_DUE = new Date("2026-11-30T21:00:00.000Z"); //  02:30 IST on 1 Dec

function txn(type: string, paise: number, at = NOV) {
  db.prepare(`INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, createdAt) VALUES (?, ?, ?, 'COMPLETED', ?, 0, ?, ?)`).run(`t${++n}`, u.userId, type, paise, `r${n}`, at);
}
const bonus = () => walletOf(db, u.userId).bonus;
const paid = () => db.prepare("SELECT kind, rewardKey, amount FROM VipReward WHERE userId = ? ORDER BY kind, rewardKey").all(u.userId) as { kind: string; rewardKey: string; amount: number }[];

beforeEach(() => {
  db = makeDb();
  u = seedUser(db, { deposit: 0 });
});

describe("VIP table", () => {
  it("ten levels, every number rising, EXP = rupees wagered", () => {
    expect(VIP_LEVELS).toHaveLength(10);
    for (let i = 1; i < 10; i++) {
      for (const k of ["expRequired", "levelUpRewardPaise", "monthlyRewardPaise", "rebateBps"] as const) expect(VIP_LEVELS[i][k]).toBeGreaterThan(VIP_LEVELS[i - 1][k]);
    }
    expect(expFromPaise(12_345)).toBe(123);
    expect(levelForExp(1_999)).toBe(0);
    expect(levelForExp(2_000)).toBe(1);
    expect(levelForExp(1e12)).toBe(10);
  });
  it("months follow India time and settle at 2:00 AM on the 1st", () => {
    expect(istMonth(new Date("2026-11-30T18:00:00Z")).key).toBe("2026-11"); // 23:30 IST on 30 Nov
    expect(istMonth(new Date("2026-11-30T19:00:00Z")).key).toBe("2026-12"); // 00:30 IST on 1 Dec
    expect(istMonth(new Date("2026-11-10T00:00:00Z")).settleAtIso).toBe("2026-11-30T20:30:00.000Z"); // 2:00 IST = 20:30 UTC
  });
});

describe("EXP", () => {
  it("counts entry fees and game bets, net of refunds; deposits and wins do not count", () => {
    txn("TOURNAMENT_ENTRY", 50_000);
    txn("GAME_BET", 30_000);
    txn("REFUND", 10_000);
    txn("DEPOSIT", 900_000);
    txn("GAME_WIN", 99_000);
    expect(wageredTotal(db, u.userId)).toBe(70_000);
    expect(vipSummary(db, u.userId, BEFORE_DUE).exp).toBe(700);
  });
});

describe("monthly settlement", () => {
  it("pays nothing before 2:00 AM on the 1st", () => {
    txn("GAME_BET", 500_000);
    settleVipRewards(db, u.userId, BEFORE_DUE);
    expect(paid()).toEqual([]);
    expect(bonus()).toBe(0);
  });

  it("at 2:00 AM pays level-up, monthly reward and rebate once, with ledger rows and one notification", () => {
    txn("GAME_BET", 500_000); // Rs 5,000 wagered -> 5,000 EXP -> VIP1
    settleVipRewards(db, u.userId, AFTER_DUE);
    const l1 = VIP_LEVELS[0];
    const rebate = Math.floor((500_000 * l1.rebateBps) / 10_000);
    expect(paid()).toEqual([
      { kind: "LEVEL", rewardKey: "1", amount: l1.levelUpRewardPaise },
      { kind: "MONTHLY", rewardKey: "2026-11", amount: l1.monthlyRewardPaise },
      { kind: "REBATE", rewardKey: "2026-11", amount: rebate },
    ]);
    expect(bonus()).toBe(l1.levelUpRewardPaise + l1.monthlyRewardPaise + rebate);
    expect(db.prepare(`SELECT COUNT(*) c FROM "Transaction" WHERE userId = ? AND type = 'BONUS_CREDIT'`).get(u.userId)).toEqual({ c: 3 });
    expect(db.prepare("SELECT COUNT(*) c FROM Notification WHERE userId = ? AND type = 'VIP_REWARD'").get(u.userId)).toEqual({ c: 1 });
    const before = bonus();
    settleVipRewards(db, u.userId, AFTER_DUE);
    settleVipRewards(db, u.userId, new Date("2026-12-20T00:00:00Z"));
    expect(bonus()).toBe(before); // idempotent
  });

  it("below VIP1 earns nothing, even with activity", () => {
    txn("GAME_BET", 100_000); // 1,000 EXP < 2,000
    settleVipRewards(db, u.userId, AFTER_DUE);
    expect(paid()).toEqual([]);
  });

  it("one big month jumps several levels: every level-up reward is paid once, rebate uses the level reached", () => {
    txn("TOURNAMENT_ENTRY", 10_000_000); // Rs 1,00,000 -> 1,00,000 EXP -> VIP3
    settleVipRewards(db, u.userId, AFTER_DUE);
    const levels = paid().filter((p) => p.kind === "LEVEL").map((p) => p.rewardKey);
    expect(levels).toEqual(["1", "2", "3"]);
    const rebate = paid().find((p) => p.kind === "REBATE")!;
    expect(rebate.amount).toBe(Math.floor((10_000_000 * VIP_LEVELS[2].rebateBps) / 10_000));
  });

  it("a later month pays its own monthly reward and rebate but not the level-up again", () => {
    txn("GAME_BET", 500_000, NOV);
    txn("GAME_BET", 400_000, "2026-12-12T08:00:00.000Z");
    settleVipRewards(db, u.userId, new Date("2027-01-01T00:00:00Z"));
    const rows = paid();
    expect(rows.filter((r) => r.kind === "LEVEL")).toHaveLength(1);
    expect(rows.filter((r) => r.kind === "MONTHLY").map((r) => r.rewardKey)).toEqual(["2026-11", "2026-12"]);
    expect(rows.filter((r) => r.kind === "REBATE")).toHaveLength(2);
  });

  it("a month where everything was refunded earns no rebate", () => {
    txn("GAME_BET", 500_000);
    txn("REFUND", 500_000);
    settleVipRewards(db, u.userId, AFTER_DUE);
    expect(paid()).toEqual([]);
  });

  it("failure never throws into the caller", () => {
    txn("GAME_BET", 500_000);
    db.exec("DROP TABLE VipReward");
    expect(() => settleVipRewards(db, u.userId, AFTER_DUE)).not.toThrow();
  });
});

describe("summary", () => {
  it("reports progress, this month's EXP and the expected payout", () => {
    txn("GAME_BET", 300_000, "2026-11-20T08:00:00.000Z");
    const s = vipSummary(db, u.userId, new Date("2026-11-25T08:00:00.000Z"));
    expect(s.level).toBe(1);
    expect(s.exp).toBe(3_000);
    expect(s.next?.level).toBe(2);
    expect(s.next?.expToNext).toBe(17_000);
    expect(s.month.exp).toBe(3_000);
    expect(s.month.settleLabel).toBe("1 Dec, 2:00 AM");
    expect(s.month.expectedMonthlyPaise).toBe(VIP_LEVELS[0].monthlyRewardPaise);
    expect(s.month.expectedRebatePaise).toBe(Math.floor((300_000 * VIP_LEVELS[0].rebateBps) / 10_000));
  });
});
