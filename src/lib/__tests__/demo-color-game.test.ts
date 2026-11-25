import { describe, expect, it } from "vitest";
import { colorsOf, payout, randomSeed, resultFromSeed, sha256Hex, sizeOf } from "../demo-color-game";

describe("demo color game", () => {
  it("maps numbers to colors and sizes", () => {
    expect(colorsOf(0)).toEqual(["red", "violet"]);
    expect(colorsOf(5)).toEqual(["green", "violet"]);
    expect(colorsOf(7)).toEqual(["green"]);
    expect(colorsOf(8)).toEqual(["red"]);
    expect(sizeOf(4)).toBe("small");
    expect(sizeOf(5)).toBe("big");
  });

  it("pays virtual points correctly", () => {
    expect(payout({ kind: "number", n: 3 }, 10, 3)).toBe(90);
    expect(payout({ kind: "number", n: 3 }, 10, 4)).toBe(0);
    expect(payout({ kind: "size", size: "big" }, 10, 9)).toBe(20);
    expect(payout({ kind: "size", size: "big" }, 10, 2)).toBe(0);
    expect(payout({ kind: "color", color: "green" }, 10, 7)).toBe(20);
    expect(payout({ kind: "color", color: "green" }, 10, 5)).toBe(15);
    expect(payout({ kind: "color", color: "red" }, 10, 0)).toBe(15);
    expect(payout({ kind: "color", color: "violet" }, 10, 0)).toBe(45);
    expect(payout({ kind: "color", color: "violet" }, 10, 3)).toBe(0);
  });

  it("result is deterministic and verifiable from the committed seed", async () => {
    const seed = randomSeed();
    const commit = await sha256Hex(seed);
    const a = await resultFromSeed(seed, "D1");
    const b = await resultFromSeed(seed, "D1");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(9);
    expect(await sha256Hex(seed)).toBe(commit);
  });
});
