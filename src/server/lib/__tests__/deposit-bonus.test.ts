import { describe, expect, it } from "vitest";
import { makeDb, seedUser, walletOf } from "@/server/providers/__tests__/helpers";
import { assertOfferUsable, computeBonus, grantDepositBonus, listOffers, settleBonusGrants } from "../deposit-bonus";

const T0 = "2026-01-01T10:00:00.000Z";
const DAY = 86_400_000;
const at = (ms: number) => new Date(new Date(T0).getTime() + ms).toISOString();

function setup(offerId: string, deposit = 100000) {
  const db = makeDb();
  const u = seedUser(db, { deposit });
  db.prepare(`INSERT INTO DepositRequest (id, userId, amount, utr, screenshotUrl, status, offerId) VALUES ('r1', ?, ?, 'UTR000000000001', 'x', 'APPROVED', ?)`).run(u.userId, deposit, offerId);
  return { db, u };
}
function bet(db: ReturnType<typeof makeDb>, userId: string, n: number, amount: number, when: string) {
  db.prepare(`INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, createdAt) VALUES (?, ?, 'GAME_BET', 'COMPLETED', ?, 0, ?, ?)`).run(`t${n}`, userId, amount, `bet${n}`, when);
}

describe("computeBonus / offers", () => {
  it("is a capped percentage and 0 below the minimum", () => {
    expect(computeBonus({ bonusPercent: 10, maxBonus: 100000, minDeposit: 10000 }, 50000)).toBe(5000);
    expect(computeBonus({ bonusPercent: 10, maxBonus: 100000, minDeposit: 10000 }, 5_000_000)).toBe(100000);
    expect(computeBonus({ bonusPercent: 10, maxBonus: 100000, minDeposit: 10000 }, 9999)).toBe(0);
  });
  it("seeds default offers and rejects unknown / too-small use", () => {
    const db = makeDb();
    expect(listOffers(db, { activeOnly: true }).length).toBeGreaterThanOrEqual(3);
    expect(() => assertOfferUsable(db, "nope", 50000)).toThrow(/no longer available/);
    expect(() => assertOfferUsable(db, "dbo_15x", 5000)).toThrow(/at least/);
    expect(assertOfferUsable(db, "dbo_15x", 50000).rollingX).toBe(15);
  });
});

describe("grantDepositBonus", () => {
  it("instant (0x) bonus is credited and immediately withdrawable", () => {
    const { db, u } = setup("dbo_instant"); // 2% of ₹1000 = ₹20
    expect(grantDepositBonus(db, "r1", T0)).toEqual({ bonus: 2000 });
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 0, winning: 2000 });
  });

  it("is idempotent per deposit", () => {
    const { db, u } = setup("dbo_15x");
    grantDepositBonus(db, "r1", T0);
    expect(grantDepositBonus(db, "r1", T0)).toBeNull();
    expect(walletOf(db, u.userId).bonus).toBe(10000);
  });

  it("no offer → nothing", () => {
    const { db } = setup("dbo_15x");
    db.prepare("UPDATE DepositRequest SET offerId = NULL").run();
    expect(grantDepositBonus(db, "r1", T0)).toBeNull();
  });

  it("rolling: stays locked until 15x of the bonus is wagered, then moves to winnings", () => {
    const { db, u } = setup("dbo_15x"); // bonus ₹100, required ₹1500
    grantDepositBonus(db, "r1", T0);
    bet(db, u.userId, 1, 100000, at(1000)); // ₹1000
    settleBonusGrants(db, u.userId, at(2000));
    expect(walletOf(db, u.userId).bonus).toBe(10000);
    bet(db, u.userId, 2, 60000, at(3000)); // total ₹1600 ≥ ₹1500
    settleBonusGrants(db, u.userId, at(4000));
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 0, winning: 10000 });
    expect(db.prepare("SELECT status FROM BonusGrant").get()).toEqual({ status: "COMPLETED" });
  });

  it("bets placed before the grant don't count", () => {
    const { db, u } = setup("dbo_15x");
    bet(db, u.userId, 1, 5_000_000, at(-DAY));
    grantDepositBonus(db, "r1", T0);
    settleBonusGrants(db, u.userId, at(1000));
    expect(walletOf(db, u.userId).bonus).toBe(10000);
  });

  it("expires after validDays: unplayed bonus is removed, deposit untouched", () => {
    const { db, u } = setup("dbo_15x");
    grantDepositBonus(db, "r1", T0);
    settleBonusGrants(db, u.userId, at(2 * DAY));
    expect(walletOf(db, u.userId).bonus).toBe(10000);
    settleBonusGrants(db, u.userId, at(3 * DAY + 1000));
    expect(walletOf(db, u.userId)).toMatchObject({ bonus: 0, deposit: 100000 });
    expect(db.prepare("SELECT status FROM BonusGrant").get()).toEqual({ status: "EXPIRED" });
  });

  it("only forfeits what is left of the bonus (spent bonus is gone, not clawed back)", () => {
    const { db, u } = setup("dbo_15x");
    grantDepositBonus(db, "r1", T0);
    db.prepare("UPDATE Wallet SET bonusBalance = 3000 WHERE userId = ?").run(u.userId);
    settleBonusGrants(db, u.userId, at(4 * DAY));
    expect(walletOf(db, u.userId).bonus).toBe(0);
  });
});
