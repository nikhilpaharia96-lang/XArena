import { describe, expect, it } from "vitest";
import { LINES, SYMBOLS, WEIGHTS, evaluate, meanMultiplier, multiplierFromRoll, spinFromHash, spinRound, symbolFromRoll, theoreticalRtp, totalCost, type Sym } from "../demo-gems";
import { randomSeed } from "../demo-color-game";

const g = (rows: Sym[][]): Sym[] => rows.flat();
const filler = [["emerald", "ruby", "topaz"], ["sapphire", "amethyst", "ruby"]] as Sym[][];

describe("demo fortune gems", () => {
  it("has 5 paylines, each of 3 distinct cells", () => {
    expect(LINES.length).toBe(5);
    for (const l of LINES) expect(new Set(l).size).toBe(3);
  });

  it("pays three of a kind (bet 50 -> line bet 10) and applies the win multiplier", () => {
    const grid = g([["sapphire", "sapphire", "sapphire"], ...filler]);
    const r = evaluate(grid, 50);
    expect(r.wins[0]).toMatchObject({ line: 0, symbol: "sapphire", amount: 30 });
    expect(r.total).toBe(30);
    expect(evaluate(grid, 50, 15).total).toBe(450);
  });

  it("wild substitutes, three wilds pay the wild amount, no win means no multiplier", () => {
    const sub = g([["diamond", "wild", "diamond"], ...filler]);
    expect(evaluate(sub, 50).wins[0]).toMatchObject({ symbol: "diamond", amount: 200 });
    const wilds = g([["wild", "wild", "wild"], ...filler]);
    expect(evaluate(wilds, 50).wins[0]).toMatchObject({ symbol: "wild", amount: 400 });
    const none = g([["ruby", "topaz", "ruby"], ["emerald", "sapphire", "topaz"], ["amethyst", "ruby", "emerald"]]);
    expect(evaluate(none, 50, 20).total).toBe(0);
  });

  it("diagonals work", () => {
    const diag = g([["ruby", "topaz", "emerald"], ["topaz", "ruby", "topaz"], ["amethyst", "emerald", "ruby"]]);
    expect(evaluate(diag, 50).wins.map((w) => w.line)).toEqual([3]);
  });

  it("extra bets costs 1.5x; base mode includes 1x, extra mode never shows 1x", () => {
    expect(totalCost(100, false)).toBe(100);
    expect(totalCost(100, true)).toBe(150);
    expect(multiplierFromRoll(0, false)).toBe(1);
    for (let i = 0; i < 200; i++) expect(multiplierFromRoll(i, true)).toBeGreaterThanOrEqual(2);
    expect(meanMultiplier(true) / meanMultiplier(false)).toBeCloseTo(1.5, 1);
  });

  it("theoretical RTP is about 95% in both modes", () => {
    for (const extra of [false, true]) {
      expect(theoreticalRtp(extra)).toBeGreaterThan(0.92);
      expect(theoreticalRtp(extra)).toBeLessThan(0.98);
    }
  });

  it("simulation: symbols follow weights; payout is close to theory", async () => {
    const counts: Record<string, number> = {};
    let staked = 0, returned = 0;
    const N = 30000;
    for (let i = 0; i < N; i++) {
      const s = await spinRound(randomSeed(), `T${i}`, false);
      staked += 50;
      returned += evaluate(s.grid, 50, s.mults[1]).total;
      for (const c of s.grid) counts[c] = (counts[c] ?? 0) + 1;
    }
    expect(returned / staked).toBeGreaterThan(0.7);
    expect(returned / staked).toBeLessThan(1.25); // high-variance game: loose bound
    const total = SYMBOLS.reduce((s, k) => s + WEIGHTS[k], 0);
    for (const s of SYMBOLS) expect(counts[s] / (N * 9)).toBeCloseTo(WEIGHTS[s] / total, 1);
  });

  it("is deterministic from the committed seed", async () => {
    const seed = randomSeed();
    expect(await spinRound(seed, "GM1", false)).toEqual(await spinRound(seed, "GM1", false));
    const s = spinFromHash("0".repeat(64), false);
    expect(s.grid.length).toBe(9);
    expect(s.mults.length).toBe(3);
    expect(symbolFromRoll(0)).toBe("diamond");
  });
});
