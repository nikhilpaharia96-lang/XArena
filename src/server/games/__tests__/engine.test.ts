import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { createGameService, type GameService } from "../engine";
import { GameError } from "../errors";
import { floatAt, floatStream, hashSeed } from "../fair";
import { BPS, crashPointBps, crashTimeFor, diceMultiplierBps, diceRoll, minePositions, payoutFor } from "../math";

let db: Database.Database;
let svc: GameService;
let clock: number;
let u: Seed;

const SERVER_SEED = "test-server-seed";
const CLIENT_SEED = "test-client-seed";

function enableAll() {
  db.prepare("UPDATE GameConfig SET isEnabled = 1").run();
}

function pinSeed(userId: string, nonce = 0) {
  db.prepare("DELETE FROM FairSeed WHERE userId = ?").run(userId);
  db.prepare("INSERT INTO FairSeed (userId, serverSeed, serverSeedHash, clientSeed, nonce, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId, SERVER_SEED, hashSeed(SERVER_SEED), CLIENT_SEED, nonce, new Date().toISOString()
  );
}

const total = (userId: string) => {
  const w = walletOf(db, userId);
  return w.deposit + w.winning + w.bonus;
};

const ledger = (userId: string) =>
  db.prepare('SELECT type, amount, balanceAfter FROM "Transaction" WHERE userId = ? ORDER BY rowid').all(userId) as { type: string; amount: number; balanceAfter: number }[];

async function expectCode(fn: () => unknown, code: string) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameError ${code}`);
}

beforeEach(() => {
  db = makeDb();
  clock = 1_700_000_000_000;
  svc = createGameService(db, { now: () => clock });
  u = seedUser(db, { deposit: 100_000 }); // ₹1000
  enableAll();
  pinSeed(u.userId);
});

describe("config & guards", () => {
  it("games ship disabled", () => {
    const fresh = makeDb();
    const s = createGameService(fresh);
    const user = seedUser(fresh, { deposit: 50_000 });
    expect(s.listConfigs().every((c) => !c.isEnabled)).toBe(true);
    return expectCode(() => s.playDice({ userId: user.userId, bet: 1000, direction: "UNDER", chanceBps: 5000 }), "GAME_DISABLED");
  });
  it("rejects bets outside min/max and non-integers, and leaves the wallet untouched", async () => {
    const before = total(u.userId);
    await expectCode(() => svc.playCoin({ userId: u.userId, bet: 500, pick: "HEADS" }), "BET_TOO_LOW");
    await expectCode(() => svc.playCoin({ userId: u.userId, bet: 100_001, pick: "HEADS" }), "BET_TOO_HIGH");
    await expectCode(() => svc.playCoin({ userId: u.userId, bet: 1000.5, pick: "HEADS" }), "INVALID_INPUT");
    await expectCode(() => svc.playCoin({ userId: u.userId, bet: -1000, pick: "HEADS" }), "INVALID_INPUT");
    expect(total(u.userId)).toBe(before);
    expect(ledger(u.userId)).toHaveLength(0);
  });
  it("rejects a dice bet whose potential payout exceeds the table limit", async () => {
    svc.updateConfig("DICE", { maxBet: 100_000, maxPayout: 150_000 });
    await expectCode(() => svc.playDice({ userId: u.userId, bet: 100_000, direction: "UNDER", chanceBps: 500 }), "PAYOUT_TOO_HIGH");
    expect(total(u.userId)).toBe(100_000);
  });
  it("admin config validation", () => {
    expect(() => svc.updateConfig("DICE", { houseEdgeBps: 0 })).toThrow(GameError);
    expect(() => svc.updateConfig("DICE", { minBet: 50 })).toThrow(GameError);
    expect(() => svc.updateConfig("DICE", { maxBet: 500, minBet: 1000 })).toThrow(GameError);
    expect(() => svc.updateConfig("DICE", { maxPayout: 100_000 })).toThrow(GameError);
    expect(svc.updateConfig("DICE", { houseEdgeBps: 300 }).houseEdgeBps).toBe(300);
  });
  it("insufficient funds fails cleanly", async () => {
    const poor = seedUser(db, { deposit: 500, n: 2 });
    await expectCode(() => svc.playCoin({ userId: poor.userId, bet: 1000, pick: "HEADS" }), "INSUFFICIENT_FUNDS");
    expect(total(poor.userId)).toBe(500);
    expect(db.prepare("SELECT COUNT(*) AS n FROM GameRound WHERE userId = ?").get(poor.userId)).toEqual({ n: 0 });
  });
});

describe("dice", () => {
  it("result matches an independent recomputation from the seeds", () => {
    for (let i = 0; i < 20; i++) {
      const roll = diceRoll(floatAt(SERVER_SEED, CLIENT_SEED, i, 0));
      const r = svc.playDice({ userId: u.userId, bet: 1000, direction: "UNDER", chanceBps: 5000 });
      expect(r.nonce).toBe(i);
      expect(r.result?.roll).toBe(roll);
      expect(r.status).toBe(roll < 5000 ? "WON" : "LOST");
      expect(r.serverSeedHash).toBe(hashSeed(SERVER_SEED));
    }
  });
  it("win: ledger bet+win, payout = floor(bet*mult)", () => {
    // find a nonce that wins UNDER 50%
    let nonce = 0;
    while (diceRoll(floatAt(SERVER_SEED, CLIENT_SEED, nonce, 0)) >= 5000) nonce++;
    pinSeed(u.userId, nonce);
    const r = svc.playDice({ userId: u.userId, bet: 10_000, direction: "UNDER", chanceBps: 5000 });
    const mult = diceMultiplierBps(5000, 200);
    expect(r.status).toBe("WON");
    expect(r.payout).toBe(payoutFor(10_000, mult));
    expect(total(u.userId)).toBe(100_000 - 10_000 + r.payout);
    expect(ledger(u.userId).map((l) => l.type)).toEqual(["GAME_BET", "GAME_WIN"]);
  });
  it("loss: only a GAME_BET ledger row", () => {
    let nonce = 0;
    while (diceRoll(floatAt(SERVER_SEED, CLIENT_SEED, nonce, 0)) < 5000) nonce++;
    pinSeed(u.userId, nonce);
    const r = svc.playDice({ userId: u.userId, bet: 10_000, direction: "UNDER", chanceBps: 5000 });
    expect(r.status).toBe("LOST");
    expect(total(u.userId)).toBe(90_000);
    expect(ledger(u.userId).map((l) => l.type)).toEqual(["GAME_BET"]);
  });
  it("validates direction and chance", async () => {
    await expectCode(() => svc.playDice({ userId: u.userId, bet: 1000, direction: "SIDEWAYS" as never, chanceBps: 5000 }), "INVALID_INPUT");
    await expectCode(() => svc.playDice({ userId: u.userId, bet: 1000, direction: "UNDER", chanceBps: 9600 }), "INVALID_INPUT");
    await expectCode(() => svc.playDice({ userId: u.userId, bet: 1000, direction: "UNDER", chanceBps: 50 }), "INVALID_INPUT");
  });
});

describe("wallet accounting (same rules as the provider wallet)", () => {
  it("bet drains bonus -> deposit -> winning; a win returns stake to those buckets, profit only to winning", () => {
    const p = seedUser(db, { bonus: 3000, deposit: 4000, winning: 5000, n: 3 });
    pinSeed(p.userId);
    // Find a coin-flip winning nonce for HEADS.
    let nonce = 0;
    while (floatAt(SERVER_SEED, CLIENT_SEED, nonce, 0) >= 0.5) nonce++;
    pinSeed(p.userId, nonce);
    const r = svc.playCoin({ userId: p.userId, bet: 10_000, pick: "HEADS" });
    expect(r.status).toBe("WON");
    expect(r.payout).toBe(19_600);
    // stake 10000 came from bonus 3000 + deposit 4000 + winning 3000, returned pro rata; profit 9600 -> winning.
    const w = walletOf(db, p.userId);
    expect(w).toEqual({ bonus: 3000, deposit: 4000, winning: 2000 + 3000 + 9600, locked: 0 });
    expect(w.bonus + w.deposit + w.winning).toBe(12_000 - 10_000 + 19_600);
  });
  it("a LOSS never changes lockedBalance and never makes a bucket negative", () => {
    const p = seedUser(db, { bonus: 100, deposit: 900, winning: 0, locked: 7777, n: 4 });
    pinSeed(p.userId);
    let nonce = 0;
    while (floatAt(SERVER_SEED, CLIENT_SEED, nonce, 0) < 0.5) nonce++; // TAILS -> picking HEADS loses
    pinSeed(p.userId, nonce);
    svc.playCoin({ userId: p.userId, bet: 1000, pick: "HEADS" });
    expect(walletOf(db, p.userId)).toEqual({ bonus: 0, deposit: 0, winning: 0, locked: 7777 });
  });
  it("ledger balanceAfter chain is consistent with the wallet", () => {
    for (let i = 0; i < 15; i++) svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    const rows = ledger(u.userId);
    expect(rows[rows.length - 1].balanceAfter).toBe(total(u.userId));
  });
  it("money is conserved: wallet delta == sum(payout) - sum(bet) over many rounds", () => {
    for (let i = 0; i < 60; i++) svc.playDice({ userId: u.userId, bet: 1000, direction: i % 2 ? "OVER" : "UNDER", chanceBps: 3000 });
    const agg = db.prepare("SELECT SUM(betAmount) AS b, SUM(payoutAmount) AS p FROM GameRound WHERE userId = ?").get(u.userId) as { b: number; p: number };
    expect(total(u.userId)).toBe(100_000 - agg.b + agg.p);
  });
});

describe("idempotency", () => {
  it("same requestId returns the same round and charges once", () => {
    const a = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS", requestId: "req-12345678" });
    const afterFirst = total(u.userId);
    const b = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS", requestId: "req-12345678" });
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
    expect(total(u.userId)).toBe(afterFirst);
    expect(db.prepare("SELECT COUNT(*) AS n FROM GameRound WHERE userId = ?").get(u.userId)).toEqual({ n: 1 });
  });
  it("requestIds are scoped per user", () => {
    const o = seedUser(db, { deposit: 50_000, n: 5 });
    svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS", requestId: "shared-req-1" });
    expect(() => svc.playCoin({ userId: o.userId, bet: 1000, pick: "HEADS", requestId: "shared-req-1" })).not.toThrow();
  });
});

describe("mines", () => {
  const layout = (nonce: number, mines: number) => minePositions(floatStream(SERVER_SEED, CLIENT_SEED, nonce), mines);

  it("hides the layout while open and reveals it after the round", () => {
    const r = svc.startMines({ userId: u.userId, bet: 10_000, mines: 3 });
    expect(r.status).toBe("ACTIVE");
    expect(JSON.stringify(r)).not.toContain('"mines":[');
    expect(r.live).toMatchObject({ mines: 3, revealed: [] });
    expect(total(u.userId)).toBe(90_000);
    const m = layout(0, 3);
    const end = svc.revealMine({ userId: u.userId, tile: m[0] });
    expect(end.status).toBe("LOST");
    expect(end.result?.mines).toEqual(m);
    expect(total(u.userId)).toBe(90_000);
  });
  it("safe reveals grow the payout and cash out pays exactly", () => {
    const m = layout(0, 3);
    const safe = [...Array(25).keys()].filter((t) => !m.includes(t));
    svc.startMines({ userId: u.userId, bet: 10_000, mines: 3 });
    const a = svc.revealMine({ userId: u.userId, tile: safe[0] });
    const b = svc.revealMine({ userId: u.userId, tile: safe[1] });
    expect(b.status).toBe("ACTIVE");
    expect((b.live as { currentMultiplierBps: number }).currentMultiplierBps).toBeGreaterThan((a.live as { currentMultiplierBps: number }).currentMultiplierBps);
    const done = svc.cashoutMines(u.userId);
    expect(done.status).toBe("WON");
    expect(done.payout).toBe(payoutFor(10_000, done.multiplierBps));
    expect(total(u.userId)).toBe(90_000 + done.payout);
    expect(ledger(u.userId).map((l) => l.type)).toEqual(["GAME_BET", "GAME_WIN"]);
  });
  it("cannot cash out before opening a tile, re-open a tile, or start two rounds", async () => {
    svc.startMines({ userId: u.userId, bet: 1000, mines: 3 });
    await expectCode(() => svc.cashoutMines(u.userId), "INVALID_INPUT");
    await expectCode(() => svc.startMines({ userId: u.userId, bet: 1000, mines: 3 }), "ROUND_ACTIVE");
    const m = layout(0, 3);
    const t = [...Array(25).keys()].find((x) => !m.includes(x))!;
    svc.revealMine({ userId: u.userId, tile: t });
    await expectCode(() => svc.revealMine({ userId: u.userId, tile: t }), "INVALID_INPUT");
    await expectCode(() => svc.revealMine({ userId: u.userId, tile: 25 }), "INVALID_INPUT");
    expect(total(u.userId)).toBe(99_000); // only one stake taken
  });
  it("clearing the board auto cashes out", () => {
    const m = layout(0, 24);
    const safe = [...Array(25).keys()].find((t) => !m.includes(t))!;
    svc.updateConfig("MINES", { maxPayout: 5_000_000 });
    svc.startMines({ userId: u.userId, bet: 1000, mines: 24 });
    const r = svc.revealMine({ userId: u.userId, tile: safe });
    expect(r.status).toBe("WON");
    expect(r.result?.autoCashout).toBe("CLEARED");
  });
  it("auto cashes out at the max payout cap, never above it", () => {
    svc.updateConfig("MINES", { maxBet: 100_000, maxPayout: 100_001 });
    const m = layout(0, 24);
    const safe = [...Array(25).keys()].find((t) => !m.includes(t))!;
    svc.startMines({ userId: u.userId, bet: 100_000, mines: 24 });
    const r = svc.revealMine({ userId: u.userId, tile: safe });
    expect(r.status).toBe("WON");
    expect(r.payout).toBe(100_001);
  });
  it("can still finish a round after the game is disabled (funds are never trapped)", () => {
    const m = layout(0, 3);
    const t = [...Array(25).keys()].find((x) => !m.includes(x))!;
    svc.startMines({ userId: u.userId, bet: 1000, mines: 3 });
    svc.updateConfig("MINES", { isEnabled: false });
    expect(svc.revealMine({ userId: u.userId, tile: t }).status).toBe("ACTIVE");
    expect(svc.cashoutMines(u.userId).status).toBe("WON");
  });
  it("a finished round cannot be settled twice", async () => {
    svc.startMines({ userId: u.userId, bet: 1000, mines: 3 });
    const m = layout(0, 3);
    svc.revealMine({ userId: u.userId, tile: m[0] });
    await expectCode(() => svc.cashoutMines(u.userId), "NO_ACTIVE_ROUND");
    await expectCode(() => svc.revealMine({ userId: u.userId, tile: 1 }), "NO_ACTIVE_ROUND");
  });
});

describe("crash", () => {
  // crash point for nonce 0 with the pinned seeds
  const point = (nonce = 0) => crashPointBps(floatAt(SERVER_SEED, CLIENT_SEED, nonce, 0), 200);

  function nonceWhere(pred: (bps: number) => boolean) {
    let n = 0;
    while (!pred(point(n))) n++;
    return n;
  }

  it("cash out before the crash pays bet * multiplier-at-that-time", () => {
    pinSeed(u.userId, nonceWhere((b) => b >= 30000));
    const r = svc.startCrash({ userId: u.userId, bet: 10_000 });
    expect(r.status).toBe("ACTIVE");
    clock += 5000; // e^(0.08*5) = 1.4918
    const out = svc.cashoutCrash(u.userId);
    expect(out.status).toBe("WON");
    expect(out.multiplierBps).toBeGreaterThan(14900);
    expect(out.multiplierBps).toBeLessThan(14950);
    expect(out.payout).toBe(payoutFor(10_000, out.multiplierBps));
    expect(total(u.userId)).toBe(90_000 + out.payout);
  });
  it("cashing out after the crash loses", () => {
    const n = nonceWhere((b) => b > 10000 && b < 15000);
    pinSeed(u.userId, n);
    svc.startCrash({ userId: u.userId, bet: 10_000 });
    clock += Math.ceil(crashTimeFor(point(n))) + 50;
    const out = svc.cashoutCrash(u.userId);
    expect(out.status).toBe("LOST");
    expect(total(u.userId)).toBe(90_000);
  });
  it("an instant crash (1.00x) loses immediately", () => {
    pinSeed(u.userId, nonceWhere((b) => b === BPS));
    const r = svc.startCrash({ userId: u.userId, bet: 10_000 });
    expect(r.status).toBe("LOST");
  });
  it("auto cash-out pays at the target even if the player never returns", () => {
    pinSeed(u.userId, nonceWhere((b) => b >= 40000));
    svc.startCrash({ userId: u.userId, bet: 10_000, autoCashoutBps: 20000 });
    clock += 60_000;
    const view = svc.crashState(u.userId)!;
    expect(view.status).toBe("WON");
    expect(view.multiplierBps).toBe(20000);
    expect(view.payout).toBe(20_000);
    expect(total(u.userId)).toBe(110_000);
  });
  it("an abandoned round is settled by the sweeper (loses if it crashed)", () => {
    pinSeed(u.userId, nonceWhere((b) => b < 20000 && b > 10000));
    svc.startCrash({ userId: u.userId, bet: 10_000 });
    clock += 600_000;
    expect(svc.sweepCrash()).toBe(1);
    expect(svc.crashState(u.userId)).toBeNull();
    expect(total(u.userId)).toBe(90_000);
  });
  it("the crash point is never exposed while the round is open", () => {
    pinSeed(u.userId, nonceWhere((b) => b >= 30000));
    const r = svc.startCrash({ userId: u.userId, bet: 10_000 });
    expect(JSON.stringify(r)).not.toContain("crashBps");
    expect(JSON.stringify(svc.crashState(u.userId))).not.toContain("crashBps");
  });
  it("max payout caps the multiplier", () => {
    svc.updateConfig("CRASH", { maxBet: 100_000, maxPayout: 150_000 });
    pinSeed(u.userId, nonceWhere((b) => b >= 1_000_000));
    svc.startCrash({ userId: u.userId, bet: 100_000 });
    clock += 600_000;
    const v = svc.crashState(u.userId)!;
    expect(v.status).toBe("WON");
    expect(v.payout).toBeLessThanOrEqual(150_000);
    expect(v.multiplierBps).toBe(15000);
  });
  it("one open round at a time; disabled-game rounds can still be cashed out", async () => {
    pinSeed(u.userId, nonceWhere((b) => b >= 30000));
    svc.startCrash({ userId: u.userId, bet: 1000 });
    await expectCode(() => svc.startCrash({ userId: u.userId, bet: 1000 }), "ROUND_ACTIVE");
    svc.updateConfig("CRASH", { isEnabled: false });
    clock += 1000;
    expect(svc.cashoutCrash(u.userId).status).toBe("WON");
  });
  it("validates auto cash-out", async () => {
    await expectCode(() => svc.startCrash({ userId: u.userId, bet: 1000, autoCashoutBps: 10050 }), "INVALID_INPUT");
  });
});

describe("seeds", () => {
  it("rotation reveals the old server seed, and past rounds verify against it", () => {
    const r = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    const rot = svc.rotateSeed(u.userId, "my-new-seed");
    expect(rot.revealed.serverSeed).toBe(SERVER_SEED);
    expect(hashSeed(rot.revealed.serverSeed)).toBe(r.serverSeedHash);
    expect(rot.current.nonce).toBe(0);
    expect(rot.current.clientSeed).toBe("my-new-seed");
    const { serverSeed } = svc.getRound(u.userId, r.id);
    expect(serverSeed).toBe(SERVER_SEED);
    const side = floatAt(serverSeed!, r.clientSeed, r.nonce, 0) < 0.5 ? "HEADS" : "TAILS";
    expect(r.result?.side).toBe(side);
  });
  it("the live server seed is never returned before rotation", () => {
    const r = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    expect(svc.getRound(u.userId, r.id).serverSeed).toBeNull();
    expect(JSON.stringify(svc.getFairInfo(u.userId))).not.toContain(SERVER_SEED);
  });
  it("cannot rotate with an open round, or with a bad client seed", async () => {
    svc.startMines({ userId: u.userId, bet: 1000, mines: 3 });
    await expectCode(() => svc.rotateSeed(u.userId), "SEED_LOCKED");
    await expectCode(() => svc.rotateSeed(u.userId, "bad seed!"), "INVALID_INPUT");
  });
  it("players cannot read each other's rounds", () => {
    const o = seedUser(db, { deposit: 10_000, n: 9 });
    const r = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    expect(() => svc.getRound(o.userId, r.id)).toThrow(GameError);
  });
});

describe("admin", () => {
  it("voiding an open round refunds the exact stake to the original buckets", () => {
    const p = seedUser(db, { bonus: 3000, deposit: 4000, winning: 5000, n: 6 });
    svc.startMines({ userId: p.userId, bet: 10_000, mines: 3 });
    expect(walletOf(db, p.userId)).toMatchObject({ bonus: 0, deposit: 0, winning: 2000 });
    const v = svc.voidRound((db.prepare("SELECT id FROM GameRound WHERE userId = ?").get(p.userId) as { id: string }).id);
    expect(v.status).toBe("VOID");
    expect(walletOf(db, p.userId)).toMatchObject({ bonus: 3000, deposit: 4000, winning: 5000 });
    expect(ledger(p.userId).map((l) => l.type)).toEqual(["GAME_BET", "REFUND"]);
  });
  it("cannot void a settled round", () => {
    const r = svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    expect(() => svc.voidRound(r.id)).toThrow(GameError);
  });
  it("stats report wagered, paid out and GGR", () => {
    for (let i = 0; i < 10; i++) svc.playCoin({ userId: u.userId, bet: 1000, pick: "HEADS" });
    const s = svc.stats().find((x) => x.gameKey === "COINFLIP")!;
    expect(s.rounds).toBe(10);
    expect(s.wagered).toBe(10_000);
    expect(s.ggr).toBe(s.wagered - s.paidOut);
  });
});

describe("concurrency", () => {
  it("two connections sharing one DB file cannot overspend the last rupees", () => {
    const file = `${process.env.TMPDIR ?? "/tmp"}/xa-games-${process.pid}-${Date.now()}.db`;
    const a = makeDb(file);
    a.pragma("journal_mode = WAL");
    seedUser(a, { deposit: 1500, n: 1 });
    a.prepare("UPDATE GameConfig SET isEnabled = 1").run();
    const b = makeDb(file);
    b.pragma("busy_timeout = 2000");
    const sa = createGameService(a);
    const sb = createGameService(b);
    let ok = 0;
    let rejected = 0;
    for (const s of [sa, sb, sa, sb]) {
      try {
        s.playCoin({ userId: "user_1", bet: 1000, pick: "HEADS" });
        ok++;
      } catch (e) {
        if (e instanceof GameError && e.code === "INSUFFICIENT_FUNDS") rejected++;
        else throw e;
      }
    }
    const w = a.prepare("SELECT depositBalance + winningBalance + bonusBalance AS t FROM Wallet WHERE userId = 'user_1'").get() as { t: number };
    expect(w.t).toBeGreaterThanOrEqual(0);
    expect(ok + rejected).toBe(4);
    a.close();
    b.close();
  });
});
