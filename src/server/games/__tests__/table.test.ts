import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { createGameService, type GameService } from "../engine";
import { GameError } from "../errors";
import { BPS } from "../math";
import {
  COLOR_PICKS, GEM_BASE_RTP, GEM_WEIGHTS, colorMultiplierBps, colorWins, gemPairMultBps, gemTripleMultBps,
  rouletteBetWins, rouletteMultiplierBps, roulettePayout, rouletteWorstCase, ROULETTE_BET_TYPES, ROULETTE_POCKETS, type RouletteBet,
} from "../table-math";

let db: Database.Database;
let svc: GameService;
let u: Seed;
const total = (id: string) => {
  const w = walletOf(db, id);
  return w.deposit + w.winning + w.bonus;
};

beforeEach(() => {
  db = makeDb();
  svc = createGameService(db);
  u = seedUser(db, { deposit: 1_000_000 });
  db.prepare("UPDATE GameConfig SET isEnabled = 1").run();
});

describe("table-game maths", () => {
  it("colour prediction returns exactly 1 - edge for every pick", () => {
    for (const edge of [200, 400, 800]) {
      for (const pick of COLOR_PICKS) {
        let rtp = 0;
        for (let n = 0; n < 10; n++) if (colorWins(pick, n)) rtp += colorMultiplierBps(pick, edge) / BPS / 10;
        expect(rtp).toBeCloseTo(1 - edge / BPS, 3);
      }
    }
  });

  it("roulette bet types: win counts match the odds, and RTP = 1 - edge", () => {
    const wins = (type: RouletteBet["type"], number?: number) => Array.from({ length: ROULETTE_POCKETS }, (_, n) => n).filter((n) => rouletteBetWins({ type, number }, n)).length;
    expect(wins("STRAIGHT", 17)).toBe(1);
    expect(wins("RED")).toBe(18);
    expect(wins("BLACK")).toBe(18);
    expect(wins("ODD")).toBe(18);
    expect(wins("LOW")).toBe(18);
    expect(wins("DOZEN2")).toBe(12);
    expect(wins("COL3")).toBe(12);
    for (const edge of [270, 500]) {
      for (const type of ROULETTE_BET_TYPES) {
        const w = wins(type, 7);
        const rtp = (w * rouletteMultiplierBps(type, edge)) / BPS / ROULETTE_POCKETS;
        expect(rtp).toBeCloseTo(1 - edge / BPS, 3);
      }
    }
  });

  it("roulette: zero loses every outside bet; worst case is the best single pocket", () => {
    const bets: RouletteBet[] = [{ type: "RED", amount: 1000 }, { type: "STRAIGHT", number: 0, amount: 100 }];
    expect(roulettePayout(bets, 0, 270)).toBe(Math.floor((100 * rouletteMultiplierBps("STRAIGHT", 270)) / BPS));
    expect(rouletteWorstCase(bets, 270)).toBeGreaterThanOrEqual(roulettePayout(bets, 1, 270));
  });

  it("fortune gems returns exactly 1 - edge by enumeration", () => {
    const T = GEM_WEIGHTS.reduce((a, b) => a + b, 0);
    for (const edge of [300, 600, 1000]) {
      let rtp = 0;
      for (let i = 0; i < GEM_WEIGHTS.length; i++) {
        const p = GEM_WEIGHTS[i] / T;
        rtp += p * p * (1 - p) * (gemPairMultBps(i, edge) / BPS) + p ** 3 * (gemTripleMultBps(i, edge) / BPS);
      }
      expect(rtp).toBeCloseTo(1 - edge / BPS, 2);
    }
    expect(GEM_BASE_RTP).toBeGreaterThan(0.5);
    expect(GEM_BASE_RTP).toBeLessThan(1.2);
  });
});

describe("table games ship live with demo + wallet", () => {
  it("defaults", () => {
    const s = createGameService(makeDb());
    for (const k of ["COLOR", "AVIATOR", "ROULETTE", "GEMS"] as const) {
      const c = s.getConfig(k);
      expect(c.isEnabled).toBe(true);
      expect(c.playMode).toBe("BOTH");
    }
  });

  it("when an admin sets Demo only, wallet play is refused and demo works", () => {
    for (const k of ["COLOR", "ROULETTE", "GEMS", "AVIATOR"] as const) svc.updateConfig(k, { playMode: "DEMO" });
    const before = total(u.userId);
    expect(() => svc.playColor({ userId: u.userId, bet: 1000, pick: "GREEN" })).toThrow(GameError);
    expect(() => svc.playRoulette({ userId: u.userId, bets: [{ type: "RED", amount: 1000 }] })).toThrow(GameError);
    expect(() => svc.playGems({ userId: u.userId, bet: 1000 })).toThrow(GameError);
    expect(() => svc.startCrash({ userId: u.userId, bet: 1000 }, "AVIATOR")).toThrow(GameError);
    expect(total(u.userId)).toBe(before);
    expect(svc.demoColor(1000, "GREEN").result.number).toBeGreaterThanOrEqual(0);
    expect(svc.demoRoulette([{ type: "RED", amount: 1000 }]).result.number).toBeLessThanOrEqual(36);
    expect(svc.demoGems(1000).result.grid).toHaveLength(3);
    expect(svc.demoAviator(1000).crashBps).toBeGreaterThanOrEqual(BPS);
    expect(total(u.userId)).toBe(before);
    expect(db.prepare("SELECT COUNT(*) c FROM GameRound").get()).toEqual({ c: 0 });
  });
});

describe("real money rounds", () => {
  beforeEach(() => {
    for (const k of ["COLOR", "ROULETTE", "GEMS", "AVIATOR"] as const) svc.updateConfig(k, { playMode: "REAL" });
  });

  it("colour: debits the stake, settles, and is idempotent per request id", () => {
    const before = total(u.userId);
    const r = svc.playColor({ userId: u.userId, bet: 1000, pick: "N3", requestId: "req-color-0001" });
    expect(["WON", "LOST"]).toContain(r.status);
    expect(total(u.userId)).toBe(before - 1000 + r.payout);
    const again = svc.playColor({ userId: u.userId, bet: 1000, pick: "N3", requestId: "req-color-0001" });
    expect(again.id).toBe(r.id);
    expect(total(u.userId)).toBe(before - 1000 + r.payout);
    expect(() => svc.playColor({ userId: u.userId, bet: 1000, pick: "BLUE" })).toThrow(GameError);
  });

  it("roulette: total stake is debited once; payout matches the result", () => {
    const bets: RouletteBet[] = [{ type: "RED", amount: 2000 }, { type: "STRAIGHT", number: 7, amount: 500 }, { type: "DOZEN1", amount: 1000 }];
    const before = total(u.userId);
    const r = svc.playRoulette({ userId: u.userId, bets });
    const n = Number((r.result as { number: number }).number);
    expect(r.bet).toBe(3500);
    expect(r.payout).toBe(roulettePayout(bets, n, 270));
    expect(total(u.userId)).toBe(before - 3500 + r.payout);
  });

  it("roulette: rejects bad layouts and over-limit layouts", () => {
    expect(() => svc.playRoulette({ userId: u.userId, bets: [] })).toThrow(GameError);
    expect(() => svc.playRoulette({ userId: u.userId, bets: [{ type: "STRAIGHT", number: 40, amount: 1000 }] })).toThrow(GameError);
    expect(() => svc.playRoulette({ userId: u.userId, bets: [{ type: "RED", amount: -5 }] })).toThrow(GameError);
    svc.updateConfig("ROULETTE", { minBet: 1000, maxBet: 100_000, maxPayout: 100_001 });
    expect(() => svc.playRoulette({ userId: u.userId, bets: [{ type: "STRAIGHT", number: 1, amount: 100_000 }] })).toThrow(GameError);
  });

  it("gems and aviator use the shared wallet and settle", () => {
    const before = total(u.userId);
    const g = svc.playGems({ userId: u.userId, bet: 1000 });
    expect(total(u.userId)).toBe(before - 1000 + g.payout);
    const a = svc.startCrash({ userId: u.userId, bet: 1000, autoCashoutBps: 12_000 }, "AVIATOR");
    expect(a.game).toBe("AVIATOR");
    expect(svc.crashState(u.userId, "AVIATOR")?.game ?? "AVIATOR").toBe("AVIATOR");
    expect(svc.crashState(u.userId, "CRASH")).toBeNull();
    expect(() => svc.startCrash({ userId: u.userId, bet: 1000 }, "AVIATOR")).toThrow(GameError);
  });

  it("DEMO-only rounds are refused again after switching back", () => {
    svc.updateConfig("COLOR", { playMode: "DEMO" });
    expect(() => svc.playColor({ userId: u.userId, bet: 1000, pick: "RED" })).toThrow(GameError);
  });
});
