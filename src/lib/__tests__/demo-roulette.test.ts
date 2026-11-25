import { describe, expect, it } from "vitest";
import { WHEEL_ORDER, betReturn, colorOf, rouletteResult } from "../demo-roulette";
import { randomSeed } from "../demo-color-game";

describe("demo roulette", () => {
  it("wheel has all 37 pockets exactly once", () => {
    expect(WHEEL_ORDER.length).toBe(37);
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
  });

  it("colors: 0 green, 18 red, 17 black, 36 red", () => {
    expect(colorOf(0)).toBe("green");
    expect(colorOf(18)).toBe("red");
    expect(colorOf(17)).toBe("black");
    expect(colorOf(36)).toBe("red");
    expect(Array.from({ length: 36 }, (_, i) => colorOf(i + 1)).filter((c) => c === "red").length).toBe(18);
  });

  it("pays standard European odds; zero loses outside bets", () => {
    expect(betReturn("n:17", 10, 17)).toBe(360);
    expect(betReturn("n:17", 10, 18)).toBe(0);
    expect(betReturn("red", 10, 18)).toBe(20);
    expect(betReturn("red", 10, 0)).toBe(0);
    expect(betReturn("even", 10, 0)).toBe(0);
    expect(betReturn("low", 10, 18)).toBe(20);
    expect(betReturn("high", 10, 19)).toBe(20);
    expect(betReturn("d2", 10, 13)).toBe(30);
    expect(betReturn("c1", 10, 34)).toBe(30);
    expect(betReturn("c3", 10, 36)).toBe(30);
  });

  it("every bet type has the same 36/37 expected return (2.7% house edge)", () => {
    const keys = ["n:7", "red", "black", "odd", "even", "low", "high", "d1", "d2", "d3", "c1", "c2", "c3"];
    for (const k of keys) {
      let sum = 0;
      for (let n = 0; n <= 36; n++) sum += betReturn(k, 1, n);
      expect(sum / 37).toBeCloseTo(36 / 37, 10);
    }
  });

  it("result is deterministic and in 0..36", async () => {
    const seed = randomSeed();
    const a = await rouletteResult(seed, "RL1");
    expect(await rouletteResult(seed, "RL1")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(36);
  });
});
