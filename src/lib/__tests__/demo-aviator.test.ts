import { describe, expect, it } from "vitest";
import { cashOutPayout, crashPointFromSeed, multiplierAt, timeToReach, MAX_MULTIPLIER } from "../demo-aviator";
import { randomSeed } from "../demo-color-game";

describe("demo aviator", () => {
  it("multiplier starts at 1.00 and only grows", () => {
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(5)).toBeGreaterThan(1.3);
    expect(multiplierAt(20)).toBeGreaterThan(multiplierAt(10));
    expect(multiplierAt(timeToReach(2))).toBeGreaterThanOrEqual(1.99);
  });

  it("crash point is deterministic and within bounds", async () => {
    const seed = randomSeed();
    const a = await crashPointFromSeed(seed, "A1");
    expect(await crashPointFromSeed(seed, "A1")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(MAX_MULTIPLIER);
  });

  it("crash distribution is plausible (about 1% instant, median near 2x)", async () => {
    const pts: number[] = [];
    for (let i = 0; i < 3000; i++) pts.push(await crashPointFromSeed(randomSeed(), `R${i}`));
    const instant = pts.filter((p) => p === 1).length / pts.length;
    const median = [...pts].sort((a, b) => a - b)[1500];
    expect(instant).toBeLessThan(0.04);
    expect(median).toBeGreaterThan(1.6);
    expect(median).toBeLessThan(2.5);
  });

  it("pays floor(stake * multiplier)", () => {
    expect(cashOutPayout(10, 2.37)).toBe(23);
    expect(cashOutPayout(100, 1)).toBe(100);
  });
});
