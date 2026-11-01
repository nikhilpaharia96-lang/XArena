import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { createGameService, type GameService } from "../engine";
import { GameError } from "../errors";
import { floatStream, hashSeed } from "../fair";
import {
  MAX_ASCENT,
  MAX_FREE_SPINS,
  PAYTABLE,
  SCATTER,
  SLOT_BASE_RTP_BPS,
  STRIPS,
  WILD,
  evaluateGrid,
  gridFromStops,
  playSlot as rollSlot,
  unitsToPaise,
  type Grid,
} from "../slot-math";

const L = 0; // LOTUS
const C = 1; // CONCH
const B = 2; // BELL

/** Builds a grid[reel][row] from rows given top-to-bottom. */
const grid = (...rows: number[][]): Grid => [0, 1, 2, 3, 4].map((reel) => rows.map((r) => r[reel]));

describe("slot: paylines", () => {
  const filler = [C, B, C, B, C];
  it("pays 3, 4 and 5 of a kind from the left on the middle line", () => {
    const three = evaluateGrid(grid(filler, [L, L, L, B, C], filler));
    expect(three.lineWins.find((w) => w.line === 0)).toMatchObject({ symbol: L, count: 3, units: PAYTABLE[L][0] });
    const five = evaluateGrid(grid(filler, [L, L, L, L, L], filler));
    expect(five.lineWins.find((w) => w.line === 0)).toMatchObject({ count: 5, units: PAYTABLE[L][2] });
  });
  it("does not pay 2 of a kind or a run that does not start on reel 1", () => {
    expect(evaluateGrid(grid([B, C, B, C, B], [L, L, B, C, B], [C, B, C, B, C])).lineUnits).toBe(0);
    expect(evaluateGrid(grid([B, C, B, C, B], [B, L, L, L, L], [C, B, C, B, C])).lineWins.find((w) => w.line === 0)).toBeUndefined();
  });
  it("wild substitutes for any symbol but never for scatter", () => {
    const g = evaluateGrid(grid([B, C, B, C, B], [L, WILD, L, C, B], [C, B, C, B, C]));
    expect(g.lineWins.find((w) => w.line === 0)).toMatchObject({ symbol: L, count: 3 });
    const s = evaluateGrid(grid([B, C, B, C, B], [L, SCATTER, L, L, L], [C, B, C, B, C]));
    expect(s.lineWins.find((w) => w.line === 0)).toBeUndefined();
  });
  it("a scatter or wild on reel 1 starts no line win", () => {
    expect(evaluateGrid(grid([B, C, B, C, B], [SCATTER, L, L, L, L], [C, B, C, B, C])).lineWins.find((w) => w.line === 0)).toBeUndefined();
  });
  it("counts scatters anywhere on the grid", () => {
    expect(evaluateGrid(grid([SCATTER, C, B, C, B], [L, C, SCATTER, B, B], [C, B, C, SCATTER, C])).scatters).toBe(3);
  });
  it("wild only exists on reels 2-4; every strip is non-empty", () => {
    expect(STRIPS[0].includes(WILD) || STRIPS[4].includes(WILD)).toBe(false);
    STRIPS.forEach((s) => expect(s.length).toBeGreaterThan(20));
  });
  it("gridFromStops wraps around the strip end", () => {
    const g = gridFromStops(STRIPS.map((s) => s.length - 1));
    expect(g[0]).toEqual([STRIPS[0][STRIPS[0].length - 1], STRIPS[0][0], STRIPS[0][1]]);
  });
});

describe("slot: money conversion", () => {
  it("is neutral at the base edge and always floors", () => {
    const neutral = 10_000 - SLOT_BASE_RTP_BPS;
    expect(unitsToPaise(10_000, 10, neutral)).toBe(10_000); // 10 units = 1x total bet
    expect(unitsToPaise(1_001, 1, neutral)).toBe(Math.floor(1_001 / 10));
    expect(unitsToPaise(10_000, 10, neutral + 1000)).toBeLessThan(10_000);
  });
});

describe("slot: free spins", () => {
  it("never exceeds the ascent cap or the free-spin limit, and is deterministic for a given stream", () => {
    let seed = 99;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    let sawFree = false;
    for (let i = 0; i < 20_000; i++) {
      const o = rollSlot(rng);
      expect(o.steps.length).toBeLessThanOrEqual(1 + MAX_FREE_SPINS);
      for (const st of o.steps) {
        expect(st.ascent).toBeLessThanOrEqual(MAX_ASCENT);
        if (!st.free) expect(st.ascent).toBe(1);
      }
      if (o.freeSpinsTriggered) {
        sawFree = true;
        expect(o.steps[0].awarded).toBeGreaterThanOrEqual(8);
      } else expect(o.steps).toHaveLength(1);
      expect(o.totalUnits).toBe(o.steps.reduce((a, s) => a + s.units, 0));
    }
    expect(sawFree).toBe(true);
    const mk = () => floatStream("s", "c", 5);
    expect(rollSlot(mk())).toEqual(rollSlot(mk()));
  });
});

describe("slot: return to player", () => {
  it("simulated RTP matches the documented base RTP (94.7% +/- 1.5)", () => {
    let seed = 2024;
    const rng = () => {
      seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
      return seed / 0x1_0000_0000;
    };
    const N = 1_500_000;
    let units = 0;
    for (let i = 0; i < N; i++) units += rollSlot(rng).totalUnits;
    const rtp = units / N / 10;
    expect(rtp).toBeGreaterThan(SLOT_BASE_RTP_BPS / 10_000 - 0.015);
    expect(rtp).toBeLessThan(SLOT_BASE_RTP_BPS / 10_000 + 0.015);
  }, 60_000);
});

// ------------------------------------------------------------------ engine --
const SERVER_SEED = "slot-server-seed";
const CLIENT_SEED = "slot-client-seed";
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

describe("slot: engine + wallet", () => {
  it("ships disabled and rejects play until an admin turns it on", () => {
    const fresh = makeDb();
    const s = createGameService(fresh);
    const user = seedUser(fresh, { deposit: 50_000 });
    expect(s.getConfig("SLOT").isEnabled).toBe(false);
    expect(() => s.playSlot({ userId: user.userId, bet: 1000 })).toThrow(GameError);
    expect(() => s.demoSlot(1000)).toThrow(GameError);
  });

  it("result is exactly reproducible from the revealed seeds, and the wallet moves by payout - bet", () => {
    for (let i = 0; i < 40; i++) {
      const before = total(u.userId);
      const r = svc.playSlot({ userId: u.userId, bet: 2000 });
      const again = rollSlot(floatStream(SERVER_SEED, CLIENT_SEED, i));
      const steps = r.result!.steps as { stops: number[] }[];
      expect(steps.map((s) => s.stops)).toEqual(again.steps.map((s) => s.stops));
      expect(r.nonce).toBe(i);
      expect(total(u.userId) - before).toBe(r.payout - 2000);
      expect(r.status).toBe(r.payout > 0 ? "WON" : "LOST");
    }
  });

  it("stake comes from bonus first; only profit lands in winning", () => {
    const p = seedUser(db, { bonus: 5000, deposit: 5000, winning: 0, n: 7 });
    pinSeed(p.userId);
    let won: ReturnType<GameService["playSlot"]> | null = null;
    for (let i = 0; i < 400 && !won; i++) {
      pinSeed(p.userId, i);
      db.prepare("UPDATE Wallet SET bonusBalance = 5000, depositBalance = 5000, winningBalance = 0 WHERE userId = ?").run(p.userId);
      db.prepare("DELETE FROM GameRound WHERE userId = ?").run(p.userId);
      const r = svc.playSlot({ userId: p.userId, bet: 4000 });
      if (r.payout > 4000) won = r;
    }
    expect(won).not.toBeNull();
    const w = walletOf(db, p.userId);
    expect(w.bonus).toBe(5000); // 4000 stake taken from bonus and returned to bonus
    expect(w.winning).toBe(won!.payout - 4000); // profit only
    expect(w.deposit).toBe(5000);
  });

  it("same requestId replays the round and never charges twice", () => {
    const a = svc.playSlot({ userId: u.userId, bet: 1000, requestId: "slotreq-0001" });
    const mid = total(u.userId);
    const b = svc.playSlot({ userId: u.userId, bet: 1000, requestId: "slotreq-0001" });
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
    expect(total(u.userId)).toBe(mid);
  });

  it("never pays more than the table's max payout, even through a free-spin round", () => {
    svc.updateConfig("SLOT", { minBet: 1000, maxBet: 1000, maxPayout: 1500 });
    let capped = 0;
    for (let i = 0; i < 600; i++) {
      const r = svc.playSlot({ userId: u.userId, bet: 1000 });
      expect(r.payout).toBeLessThanOrEqual(1500);
      if (r.result!.capped) capped++;
    }
    expect(capped).toBeGreaterThan(0);
  });

  it("rejects an invalid bet and an overdraft without touching the wallet", () => {
    const poor = seedUser(db, { deposit: 500, n: 9 });
    expect(() => svc.playSlot({ userId: poor.userId, bet: 1000 })).toThrow(/Insufficient/);
    expect(() => svc.playSlot({ userId: u.userId, bet: 500 })).toThrow(GameError);
    expect(total(poor.userId)).toBe(500);
  });

  it("demo mode writes nothing: no round, no ledger row, wallet unchanged", () => {
    const rounds = count("SELECT COUNT(*) n FROM GameRound");
    const txs = count('SELECT COUNT(*) n FROM "Transaction"');
    const before = total(u.userId);
    for (let i = 0; i < 50; i++) {
      const d = svc.demoSlot(5000);
      expect(d.steps.length).toBeGreaterThan(0);
    }
    expect(count("SELECT COUNT(*) n FROM GameRound")).toBe(rounds);
    expect(count('SELECT COUNT(*) n FROM "Transaction"')).toBe(txs);
    expect(total(u.userId)).toBe(before);
  });
});
