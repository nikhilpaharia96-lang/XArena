import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { awardReferralForDeposit, referralSummary } from "../referral";
import { DAILY_QUALIFIED_CAP, FRIEND_REWARD_PAISE, REFERRAL_MILESTONES, REFERRER_REWARD_PAISE } from "@/lib/referral";

let db: Database.Database;
let n = 0;
let un = 0;
const mk = () => seedUser(db, { deposit: 0, n: ++un });
const NOW = "2026-11-20T08:00:00.000Z";

function friendOf(referrer: Seed): Seed {
  const f = mk();
  db.prepare("INSERT INTO Referral (id, referrerId, referredUserId, bonusAmount, bonusPaidAt, createdAt) VALUES (?, ?, ?, 0, NULL, ?)").run(`ref${++n}`, referrer.userId, f.userId, NOW);
  return f;
}
function deposit(u: Seed, paise: number, at = NOW) {
  db.prepare(`INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, createdAt) VALUES (?, ?, 'DEPOSIT', 'COMPLETED', ?, 0, ?, ?)`).run(`d${++n}`, u.userId, paise, `dr${n}`, at);
  awardReferralForDeposit(db, u.userId, at);
}
const bonus = (u: Seed) => walletOf(db, u.userId).bonus;

beforeEach(() => {
  db = makeDb();
  un = 0;
});

describe("referral rewards", () => {
  it("pays nothing on signup, then pays both sides once the friend deposits enough", () => {
    const a = mk();
    const f = friendOf(a);
    expect(bonus(a)).toBe(0);
    deposit(f, 5_000); // below the ₹100 minimum
    expect(bonus(a)).toBe(0);
    expect(bonus(f)).toBe(0);
    deposit(f, 5_000); // cumulative ₹100
    expect(bonus(a)).toBe(REFERRER_REWARD_PAISE);
    expect(bonus(f)).toBe(FRIEND_REWARD_PAISE);
  });

  it("never pays the same friend twice", () => {
    const a = mk();
    const f = friendOf(a);
    deposit(f, 20_000);
    deposit(f, 20_000);
    deposit(f, 20_000);
    expect(bonus(a)).toBe(REFERRER_REWARD_PAISE);
    expect(bonus(f)).toBe(FRIEND_REWARD_PAISE);
  });

  it("users without a referrer get nothing", () => {
    const solo = mk();
    deposit(solo, 50_000);
    expect(bonus(solo)).toBe(0);
  });

  it("pays milestone bonuses exactly once at 5 friends", () => {
    const a = mk();
    for (let i = 0; i < 5; i++) deposit(friendOf(a), 10_000, `2026-11-${10 + i}T08:00:00.000Z`);
    const m5 = REFERRAL_MILESTONES[0].rewardPaise;
    expect(bonus(a)).toBe(5 * REFERRER_REWARD_PAISE + m5);
    const s = referralSummary(db, a.userId);
    expect(s.qualified).toBe(5);
    expect(s.milestones[0]).toMatchObject({ reached: true, paid: true });
    expect(s.milestones[1].reached).toBe(false);
    expect(s.earnedPaise).toBe(5 * REFERRER_REWARD_PAISE + m5);
  });

  it("stops at the daily cap, and the rest stay pending", () => {
    const a = mk();
    const friends = Array.from({ length: DAILY_QUALIFIED_CAP + 2 }, () => friendOf(a));
    friends.forEach((f) => deposit(f, 10_000));
    expect(referralSummary(db, a.userId).qualified).toBe(DAILY_QUALIFIED_CAP);
    expect(referralSummary(db, a.userId).pending).toBe(2);
    // next day the pending ones qualify on their next deposit
    deposit(friends[DAILY_QUALIFIED_CAP], 10_000, "2026-11-22T09:00:00.000Z");
    expect(referralSummary(db, a.userId).qualified).toBe(DAILY_QUALIFIED_CAP + 1);
  });

  it("does not pay when the referrer is banned", () => {
    const a = mk();
    db.prepare("UPDATE User SET status = 'BANNED' WHERE id = ?").run(a.userId);
    const f = friendOf(a);
    deposit(f, 10_000);
    expect(bonus(a)).toBe(0);
    expect(bonus(f)).toBe(0);
  });

  it("writes REFERRAL_BONUS ledger rows for both sides", () => {
    const a = mk();
    const f = friendOf(a);
    deposit(f, 10_000);
    const t = (u: Seed) => db.prepare(`SELECT amount FROM "Transaction" WHERE userId = ? AND type = 'REFERRAL_BONUS'`).all(u.userId) as { amount: number }[];
    expect(t(a)).toEqual([{ amount: REFERRER_REWARD_PAISE }]);
    expect(t(f)).toEqual([{ amount: FRIEND_REWARD_PAISE }]);
  });
});
