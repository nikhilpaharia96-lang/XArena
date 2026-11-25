import { describe, expect, it } from "vitest";
import { LINES, SYMBOLS, WEIGHTS, evaluate, gridFromHash, spinGrid, symbolFromRoll, theoreticalRtp, type Sym } from "../demo-gems";
import { randomSeed } from "../demo-color-game";

const g = (rows: Sym[][]): Sym[] => rows.flat();

describe("demo fortune gems", () => {
  it("has 5 paylines, each of 3 distinct cells", () => {
    expect(LINES.length).toBe(5);
    for (const l of LINES) expect(new Set(l).size).toBe(3);
  });

  it("pays three of a kind on a line (bet 50 -> line bet 10)", () => {
    const grid = g([["ruby", "ruby", "ruby"], ["topaz", "emerald", "sapphire"], ["amethyst", "ruby", "emerald"]]);
    const r = evaluate(grid, 50);
    expect(r.wins.length).toBe(1);
    expect(r.wins[0]).toMatchObject({ line: 0, symbol: "ruby", amount: 40 });
    expect(r.total).toBe(40);
  });

  it("wild substitutes, and three wilds pay the wild amount", () => {
    const sub = g([["diamond", "wild", "diamond"], ["ruby", "emerald", "topaz"], ["sapphire", "amethyst", "ruby"]]);
    expect(evaluate(sub, 50).wins[0]).toMatchObject({ symbol: "diamond", amount: 500 });
    const wilds = g([["wild", "wild", "wild"], ["ruby", "emerald", "topaz"], ["sapphire", "amethyst", "ruby"]]);
    expect(evaluate(wilds, 50).wins[0]).toMatchObject({ symbol: "wild", amount: 1000 });
  });

  it("mixed gems do not pay; diagonals work", () => {
    const none = g([["ruby", "topaz", "ruby"], ["emerald", "sapphire", "topaz"], ["amethyst", "ruby", "emerald"]]);
    expect(evaluate(none, 50).total).toBe(0);
    const diag = g([["ruby", "topaz", "emerald"], ["topaz", "ruby", "topaz"], ["amethyst", "emerald", "ruby"]]);
    const r = evaluate(diag, 50);
    expect(r.wins.map((w) => w.line)).toEqual([3]);
  });

  it("theoretical RTP is about 95%", () => {
    expect(theoreticalRtp()).toBeGreaterThan(0.9);
    expect(theoreticalRtp()).toBeLessThan(0.99);
  });

  it("simulated RTP matches theory and rolls follow the weights", async () => {
    // Use hashes of fresh seeds, exactly like the game does.
    let staked = 0, returned = 0;
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const grid = await spinGrid(randomSeed(), `T${i}`);
      staked += 50;
      returned += evaluate(grid, 50).total;
      for (const s of grid) counts[s] = (counts[s] ?? 0) + 1;
    }
    expect(returned / staked).toBeGreaterThan(0.75);
    expect(returned / staked).toBeLessThan(1.2); // high-variance game: loose bound
    const total = SYMBOLS.reduce((s, k) => s + WEIGHTS[k], 0);
    for (const s of SYMBOLS) expect(counts[s] / (N * 9)).toBeCloseTo(WEIGHTS[s] / total, 1);
  });

  it("is deterministic from the committed seed", async () => {
    const seed = randomSeed();
    expect(await spinGrid(seed, "GM1")).toEqual(await spinGrid(seed, "GM1"));
    expect(gridFromHash("0".repeat(64)).length).toBe(9);
    expect(symbolFromRoll(0)).toBe("diamond");
  });
});
