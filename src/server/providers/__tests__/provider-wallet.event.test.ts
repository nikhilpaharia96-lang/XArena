import { describe, expect, it } from "vitest";
import { createProviderWallet, WalletError, type ApplyEventInput } from "../provider-wallet";
import { makeDb, seedUser, walletOf } from "./helpers";

function setup(opts: Parameters<typeof seedUser>[1] = {}) {
  const db = makeDb();
  const seed = seedUser(db, opts);
  const wallet = createProviderWallet(db);
  let n = 0;
  const ev = (o: Partial<ApplyEventInput> & { id?: string }) =>
    wallet.applyRoundEvent({
      provider: "betnex",
      providerTransactionId: o.id ?? `tx${++n}`,
      userId: seed.userId,
      roundKey: "g1:r1",
      currency: "INR",
      stakePaise: 0,
      stakeRefundPaise: 0,
      winPaise: 0,
      winReversalPaise: 0,
      ...o,
    });
  return { db, seed, wallet, ev, w: () => walletOf(db, seed.userId) };
}

describe("applyRoundEvent — policy: deposit money stays play-only", () => {
  it("separate bet then win: stake returns to deposit, only profit becomes withdrawable", () => {
    const { ev, w } = setup({ deposit: 1000 });
    expect(ev({ stakePaise: 600 }).balancePaise).toBe(400);
    expect(ev({ winPaise: 800 }).balancePaise).toBe(1200);
    expect(w()).toMatchObject({ deposit: 1000, winning: 200, bonus: 0 });
  });

  it("the same round as ONE callback gives the identical result", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakePaise: 600, winPaise: 800 });
    expect(w()).toMatchObject({ deposit: 1000, winning: 200 });
  });

  it("a bet won back exactly (1x) must NOT turn deposit into withdrawable money", () => {
    const { ev, w } = setup({ deposit: 5000 });
    ev({ stakePaise: 5000 });
    ev({ winPaise: 5000 });
    expect(w()).toMatchObject({ deposit: 5000, winning: 0 });
  });

  it("a lost round just loses the stake", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakePaise: 600 });
    expect(w()).toMatchObject({ deposit: 400, winning: 0 });
  });

  it("multiple wins in one round (free spins): stake back first, then profit", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakePaise: 600 });
    ev({ winPaise: 300 }); // all stake
    expect(w()).toMatchObject({ deposit: 700, winning: 0 });
    ev({ winPaise: 500 }); // 300 stake left + 200 profit
    expect(w()).toMatchObject({ deposit: 1000, winning: 200 });
    ev({ winPaise: 100 }); // pure profit
    expect(w()).toMatchObject({ deposit: 1000, winning: 300 });
  });

  it("stake taken bonus -> deposit -> winning comes back to the same buckets pro rata", () => {
    const { ev, w } = setup({ bonus: 200, deposit: 300, winning: 500 });
    ev({ stakePaise: 700 }); // bonus 200, deposit 300, winning 200
    expect(w()).toMatchObject({ bonus: 0, deposit: 0, winning: 300 });
    ev({ winPaise: 1000 }); // stake 700 back pro rata + 300 profit
    expect(w()).toMatchObject({ bonus: 200, deposit: 300, winning: 300 + 200 + 300 });
  });

  it("rounds are independent: a win in round B can't reclaim stake from round A", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakePaise: 500, roundKey: "g1:A" });
    ev({ winPaise: 400, roundKey: "g1:B" }); // no stake in B → all profit
    expect(w()).toMatchObject({ deposit: 500, winning: 400 });
  });
});

describe("applyRoundEvent — refunds and corrections (negative amounts)", () => {
  it("bet refund returns to the original buckets", () => {
    const { ev, w } = setup({ bonus: 100, deposit: 400 });
    ev({ stakePaise: 300 }); // bonus 100, deposit 200
    ev({ stakeRefundPaise: 300 });
    expect(w()).toMatchObject({ bonus: 100, deposit: 400, winning: 0 });
  });

  it("refund larger than the known stake: the excess is play-only, never withdrawable", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakeRefundPaise: 500 }); // no stake on record
    expect(w()).toMatchObject({ deposit: 1500, winning: 0 });
  });

  it("win reversal is clawed back from winning first", () => {
    const { ev, w } = setup({ deposit: 1000 });
    ev({ stakePaise: 600, winPaise: 1000 }); // deposit 1000, winning 400
    ev({ winReversalPaise: 400 });
    expect(w()).toMatchObject({ deposit: 1000, winning: 0 });
  });

  it("a reversal larger than what's left never pushes a bucket negative and records the shortfall", () => {
    const { ev, w, db } = setup({ winning: 100 });
    const r = ev({ winReversalPaise: 250, id: "rev" });
    expect(r.balancePaise).toBe(0);
    expect(w()).toMatchObject({ deposit: 0, winning: 0, bonus: 0 });
    const meta = JSON.parse((db.prepare("SELECT metadata m FROM ProviderTransaction WHERE providerTransactionId='rev'").get() as { m: string }).m);
    expect(meta.unrecovered).toBe(150);
  });

  it("matches the formula balance - bet + win for each documented example (start 2000)", () => {
    const cases: [Partial<ApplyEventInput>, number][] = [
      [{ stakePaise: 600 }, 1400],
      [{ winPaise: 800 }, 2800],
      [{ stakeRefundPaise: 600 }, 2600], // bet = -600
      [{ winReversalPaise: 800 }, 1200], // win = -800
      [{ stakeRefundPaise: 600, winReversalPaise: 800 }, 1800],
    ];
    for (const [input, expected] of cases) {
      const { ev } = setup({ deposit: 2000 });
      expect(ev(input).balancePaise).toBe(expected);
    }
  });
});

describe("applyRoundEvent — safety", () => {
  it("rejects a stake the player can't cover and changes nothing", () => {
    const { ev, w } = setup({ deposit: 100, locked: 5000 });
    expect(() => ev({ stakePaise: 101 })).toThrow(WalletError);
    expect(w()).toMatchObject({ deposit: 100 });
  });

  it("duplicate transaction id is applied once and returns the stored balance", () => {
    const { ev, w, db } = setup({ deposit: 1000 });
    const first = ev({ id: "same", stakePaise: 300 });
    const again = ev({ id: "same", stakePaise: 300 });
    expect(again).toEqual({ outcome: "DUPLICATE", balancePaise: first.balancePaise });
    expect(w().deposit).toBe(700);
    expect((db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c).toBe(1);
  });

  it("same id with a different payload is refused", () => {
    const { ev } = setup({ deposit: 1000 });
    ev({ id: "same", stakePaise: 300 });
    expect(() => ev({ id: "same", stakePaise: 999 })).toThrow(/different payload/);
  });

  it("rejects non-integer / negative / absurd amounts", () => {
    const { ev } = setup({ deposit: 1000 });
    expect(() => ev({ stakePaise: 1.5 })).toThrow(WalletError);
    expect(() => ev({ winPaise: -1 })).toThrow(WalletError);
    expect(() => ev({ winPaise: Number.MAX_SAFE_INTEGER })).toThrow(WalletError);
  });

  it("writes a ledger row per movement", () => {
    const { ev, db } = setup({ deposit: 1000 });
    ev({ stakePaise: 600, winPaise: 800 });
    const types = (db.prepare('SELECT type FROM "Transaction" ORDER BY createdAt, id').all() as { type: string }[]).map((r) => r.type).sort();
    expect(types).toEqual(["GAME_BET", "GAME_WIN"]);
  });

  it("property: for realistic orderings (stake before win within a round) total == start - bets + wins, no bucket is ever negative, and withdrawable money never exceeds real round profit", () => {
    for (let seed = 1; seed <= 80; seed++) {
      let x = seed * 2654435761;
      const rnd = (n: number) => ((x = (x * 1664525 + 1013904223) >>> 0) % n);
      const startDeposit = 20_000;
      const { ev, w } = setup({ deposit: startDeposit });

      // Each round is its own ordered script: stake(s) first, then win(s).
      const scripts = Array.from({ length: 4 }, (_, r) => ({
        key: `g:r${r}`,
        steps: [
          ...Array.from({ length: 1 + rnd(2) }, () => ({ stake: 100 + rnd(600), win: 0 })),
          ...Array.from({ length: rnd(4) }, () => ({ stake: 0, win: rnd(900) })),
        ],
        bet: 0,
        winSum: 0,
      }));

      let expected = startDeposit;
      // Randomly interleave rounds while keeping each round's own order.
      while (scripts.some((s) => s.steps.length > 0)) {
        const live = scripts.filter((s) => s.steps.length > 0);
        const sc = live[rnd(live.length)];
        const step = sc.steps.shift()!;
        const bal = w().deposit + w().winning + w().bonus;
        const stake = Math.min(step.stake, bal);
        ev({ roundKey: sc.key, stakePaise: stake, winPaise: step.win });
        expected += step.win - stake;
        sc.bet += stake;
        sc.winSum += step.win;
        const cur = w();
        expect(cur.deposit).toBeGreaterThanOrEqual(0);
        expect(cur.winning).toBeGreaterThanOrEqual(0);
        expect(cur.deposit + cur.winning + cur.bonus).toBe(expected);
      }

      const realProfit = scripts.reduce((sum, sc) => sum + Math.max(0, sc.winSum - sc.bet), 0);
      expect(w().winning).toBeLessThanOrEqual(realProfit);
    }
  });
});
