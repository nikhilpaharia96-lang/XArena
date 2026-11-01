import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { createGameService, type GameService } from "../engine";
import { GameError } from "../errors";
import { floatStream, hashSeed } from "../fair";
import {
  COINS_BASE_RTP_BPS,
  COIN,
  COIN_CELLS,
  COIN_RESPINS,
  COIN_STRIPS,
  COIN_WILD,
  GRAND_UNITS,
  WAYS_PAY,
  coinGridFromStops,
  coinUnitsToPaise,
  evaluateWays,
  playCoins as roll,
  type CoinGrid,
} from "../coins-math";

const D = 0; // DIYA
const B = 1; // BANGLE
const K = 3; // KALASH

/** grid[reel][row] from rows given top-to-bottom. */
const grid = (...rows: number[][]): CoinGrid => [0, 1, 2, 3, 4].map((reel) => rows.map((r) => r[reel]));

describe("coins: ways to win", () => {
  it("multiplies matching cells per reel and pays from reel 1", () => {
    // DIYA: reel1 x2, reel2 x1, reel3 x3 -> 6 ways over 3 reels
    const g = grid([D, D, D, B, B], [D, B, D, B, B], [B, B, D, B, B]);
    const w = evaluateWays(g).wins.find((x) => x.symbol === D)!;
    expect(w).toMatchObject({ reels: 3, ways: 2 * 1 * 3 });
    expect(w.units).toBe(WAYS_PAY[D][0] * 6);
  });
  it("needs 3 adjacent reels starting at reel 1", () => {
    const g = grid([B, D, D, D, D], [B, D, D, D, D], [B, D, D, D, D]);
    expect(evaluateWays(g).wins.find((x) => x.symbol === D)).toBeUndefined();
    const two = grid([D, D, B, B, B], [K, K, K, K, K], [K, K, K, K, K]);
    expect(evaluateWays(two).wins.find((x) => x.symbol === D)).toBeUndefined();
  });
  it("wild substitutes for paying symbols but never for COIN", () => {
    const g = grid([D, COIN_WILD, D, B, B], [K, K, K, K, K], [K, K, K, K, K]);
    expect(evaluateWays(g).wins.find((x) => x.symbol === D)).toMatchObject({ reels: 3, ways: 1 });
    const c = grid([COIN, COIN_WILD, COIN, B, B], [K, B, K, K, K], [B, B, B, K, K]);
    expect(evaluateWays(c).wins.every((x) => x.symbol <= 5)).toBe(true);
  });
  it("wild never sits on reels 1 and 5; every strip is non-empty", () => {
    expect(COIN_STRIPS[0].includes(COIN_WILD) || COIN_STRIPS[4].includes(COIN_WILD)).toBe(false);
    COIN_STRIPS.forEach((s) => expect(s.length).toBeGreaterThan(30));
  });
  it("grid wraps around the strip end", () => {
    const g = coinGridFromStops(COIN_STRIPS.map((s) => s.length - 1));
    expect(g[0]).toEqual([COIN_STRIPS[0][COIN_STRIPS[0].length - 1], COIN_STRIPS[0][0], COIN_STRIPS[0][1]]);
  });
});

describe("coins: respin bonus", () => {
  function mulberry(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  it("bonus only triggers with 6+ coins; locked coins never move; respins obey the reset rule", () => {
    const rng = mulberry(7);
    let bonuses = 0;
    for (let i = 0; i < 400_000 && bonuses < 40; i++) {
      const o = roll(rng);
      if (o.coinCount < 6) {
        expect(o.bonus).toBeNull();
        continue;
      }
      bonuses++;
      const b = o.bonus!;
      expect(b.initial).toHaveLength(o.coinCount);
      const seen = new Set(b.initial.map((c) => c.cell));
      let left = COIN_RESPINS;
      for (const r of b.rounds) {
        left = r.newCoins.length > 0 ? COIN_RESPINS : left - 1;
        expect(r.respinsLeft).toBe(left);
        for (const c of r.newCoins) {
          expect(seen.has(c.cell)).toBe(false); // a locked cell is never re-rolled
          expect(c.cell).toBeGreaterThanOrEqual(0);
          expect(c.cell).toBeLessThan(COIN_CELLS);
          seen.add(c.cell);
        }
      }
      expect(b.full).toBe(seen.size === COIN_CELLS);
      expect(b.grandUnits).toBe(b.full ? GRAND_UNITS : 0);
      if (!b.full) expect(left).toBe(0); // ended because respins ran out
      const sum = [...b.initial, ...b.rounds.flatMap((r) => r.newCoins)].reduce((a, c) => a + c.units, 0);
      expect(b.coinUnits).toBe(sum);
      expect(o.totalUnits).toBe(o.waysUnits + b.coinUnits + b.grandUnits);
    }
    expect(bonuses).toBeGreaterThan(5);
  });
  it("is deterministic for the same random stream", () => {
    const mk = () => floatStream("seed", "client", 3);
    expect(roll(mk())).toEqual(roll(mk()));
  });
});

describe("coins: money conversion and RTP", () => {
  it("is neutral at the base edge and floors", () => {
    const neutral = 10_000 - COINS_BASE_RTP_BPS;
    expect(coinUnitsToPaise(10_000, 20, neutral)).toBe(10_000);
    expect(coinUnitsToPaise(1_001, 1, neutral)).toBe(Math.floor(1_001 / 20));
    expect(coinUnitsToPaise(10_000, 20, neutral + 1000)).toBeLessThan(10_000);
  });
  it("simulated RTP matches the documented base RTP (+/- 3.5)", () => {
    let seed = 31337;
    const rng = () => {
      seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
      return seed / 0x1_0000_0000;
    };
    const N = 2_000_000;
    let units = 0;
    for (let i = 0; i < N; i++) units += roll(rng).totalUnits;
    const rtp = units / N / 20;
    expect(rtp).toBeGreaterThan(COINS_BASE_RTP_BPS / 10_000 - 0.035);
    expect(rtp).toBeLessThan(COINS_BASE_RTP_BPS / 10_000 + 0.035);
  }, 90_000);
});

// ------------------------------------------------------------------ engine --
const SERVER_SEED = "coins-server-seed";
const CLIENT_SEED = "coins-client-seed";
let db: Database.Database;
let svc: GameService;
let u: Seed;

function pinSeed(userId: string, nonce = 0) {
  db.prepare("DELETE FROM FairSeed WHERE userId = ?").run(userId);
  db.prepare("INSERT INTO FairSeed (userId, serverSeed, serverSeedHash, clientSeed, nonce, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId, SERVER_SEED, hashSeed(SERVER_SEED), CLIENT_SEED, nonce, new Date().toISOString()
  );
}
const total = (id: string) => { const w = walletOf(db, id); return w.deposit + w.winning + w.bonus; };
const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

beforeEach(() => {
  db = makeDb();
  svc = createGameService(db);
  u = seedUser(db, { deposit: 100_000_000 });
  db.prepare("UPDATE GameConfig SET isEnabled = 1").run();
  pinSeed(u.userId);
});

describe("coins: engine + wallet", () => {
  it("ships disabled", () => {
    const fresh = makeDb();
    const s = createGameService(fresh);
    const user = seedUser(fresh, { deposit: 50_000 });
    expect(s.getConfig("COINS").isEnabled).toBe(false);
    expect(() => s.playCoinsGame({ userId: user.userId, bet: 1000 })).toThrow(GameError);
    expect(() => s.demoCoins(1000)).toThrow(GameError);
  });

  it("is reproducible from the seeds, and the wallet moves by payout - bet", () => {
    for (let i = 0; i < 40; i++) {
      const before = total(u.userId);
      const r = svc.playCoinsGame({ userId: u.userId, bet: 2000 });
      const again = roll(floatStream(SERVER_SEED, CLIENT_SEED, i));
      expect((r.result as { stops: number[] }).stops).toEqual(again.stops);
      expect(total(u.userId) - before).toBe(r.payout - 2000);
      expect(r.status).toBe(r.payout > 0 ? "WON" : "LOST");
    }
  });

  it("replays the same requestId without charging twice", () => {
    const a = svc.playCoinsGame({ userId: u.userId, bet: 1000, requestId: "coinsreq-001" });
    const mid = total(u.userId);
    const b = svc.playCoinsGame({ userId: u.userId, bet: 1000, requestId: "coinsreq-001" });
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
    expect(total(u.userId)).toBe(mid);
  });

  it("never pays above the table's max payout", () => {
    svc.updateConfig("COINS", { minBet: 1000, maxBet: 1000, maxPayout: 1200 });
    let capped = 0;
    for (let i = 0; i < 500; i++) {
      const r = svc.playCoinsGame({ userId: u.userId, bet: 1000 });
      expect(r.payout).toBeLessThanOrEqual(1200);
      if ((r.result as { capped: boolean }).capped) capped++;
    }
    expect(capped).toBeGreaterThan(0);
  });

  it("rejects an overdraft and a bad bet without touching the wallet", () => {
    const poor = seedUser(db, { deposit: 500, n: 9 });
    expect(() => svc.playCoinsGame({ userId: poor.userId, bet: 1000 })).toThrow(/Insufficient/);
    expect(() => svc.playCoinsGame({ userId: u.userId, bet: 500 })).toThrow(GameError);
    expect(total(poor.userId)).toBe(500);
  });

  it("demo mode writes nothing", () => {
    const rounds = count("SELECT COUNT(*) n FROM GameRound");
    const txs = count('SELECT COUNT(*) n FROM "Transaction"');
    const before = total(u.userId);
    for (let i = 0; i < 50; i++) expect(svc.demoCoins(5000).grid).toHaveLength(5);
    expect(count("SELECT COUNT(*) n FROM GameRound")).toBe(rounds);
    expect(count('SELECT COUNT(*) n FROM "Transaction"')).toBe(txs);
    expect(total(u.userId)).toBe(before);
  });
});
