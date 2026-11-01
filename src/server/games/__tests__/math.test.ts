import { describe, expect, it } from "vitest";
import {
  BPS, coinMultiplierBps, crashMultiplierAt, crashPointBps, crashTimeFor, diceMultiplierBps, diceRoll, diceWins,
  minePositions, minesMultiplierBps, payoutFor,
} from "../math";
import { floatAt, floatStream, hashSeed } from "../fair";

describe("fair RNG", () => {
  it("is deterministic and in [0,1)", () => {
    const a = floatAt("seed", "client", 5, 0);
    expect(a).toBe(floatAt("seed", "client", 5, 0));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
  it("changes with every input", () => {
    const base = floatAt("s", "c", 1, 0);
    expect(floatAt("s2", "c", 1, 0)).not.toBe(base);
    expect(floatAt("s", "c2", 1, 0)).not.toBe(base);
    expect(floatAt("s", "c", 2, 0)).not.toBe(base);
    expect(floatAt("s", "c", 1, 1)).not.toBe(base);
  });
  it("hashSeed is SHA-256 hex", () => {
    expect(hashSeed("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("is roughly uniform", () => {
    const n = 20000;
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < n; i++) buckets[Math.floor(floatAt("uniform", "x", i, 0) * 10)]++;
    for (const b of buckets) expect(Math.abs(b - n / 10)).toBeLessThan(n / 10 * 0.1);
  });
});

describe("payoutFor", () => {
  it("floors and never loses precision on huge values", () => {
    expect(payoutFor(333, 19600)).toBe(652); // 652.68 -> floor
    expect(payoutFor(1_000_000_000, 10_000_000)).toBe(1_000_000_000_000);
    expect(payoutFor(100, 0)).toBe(0);
  });
});

describe("dice", () => {
  it("never pays more than (1 - edge) in expectation, and not much less", () => {
    for (const edge of [100, 200, 500]) {
      for (const chance of [100, 500, 2500, 5000, 7500, 9500]) {
        const mult = diceMultiplierBps(chance, edge);
        const ev = (chance / BPS) * (mult / BPS);
        expect(ev).toBeLessThanOrEqual(1 - edge / BPS + 1e-12);
        expect(ev).toBeGreaterThan(1 - edge / BPS - 0.002);
      }
    }
  });
  it("win probability is exactly chance for both directions", () => {
    for (const chance of [100, 5000, 9500]) {
      let under = 0, over = 0;
      for (let roll = 0; roll < BPS; roll++) {
        if (diceWins(roll, "UNDER", chance)) under++;
        if (diceWins(roll, "OVER", chance)) over++;
      }
      expect(under).toBe(chance);
      expect(over).toBe(chance);
    }
  });
  it("roll is within 0..9999", () => {
    expect(diceRoll(0)).toBe(0);
    expect(diceRoll(0.99999999)).toBe(9999);
  });
});

describe("coin flip", () => {
  it("pays 1.96x at 2% edge", () => expect(coinMultiplierBps(200)).toBe(19600));
});

describe("mines", () => {
  it("places exactly N unique mines in 0..24, deterministically", () => {
    for (const n of [1, 3, 10, 24]) {
      const m = minePositions(floatStream("s", "c", n), n);
      expect(m).toHaveLength(n);
      expect(new Set(m).size).toBe(n);
      expect(m.every((t) => t >= 0 && t < 25)).toBe(true);
      expect(m).toEqual(minePositions(floatStream("s", "c", n), n));
    }
  });
  it("every tile is equally likely to be a mine", () => {
    const counts = new Array(25).fill(0);
    const trials = 5000;
    for (let i = 0; i < trials; i++) for (const t of minePositions(floatStream("mm", "c", i), 5)) counts[t]++;
    for (const c of counts) expect(Math.abs(c - trials * 0.2)).toBeLessThan(trials * 0.2 * 0.15);
  });
  it("EV never exceeds (1 - edge) at any depth / mine count", () => {
    for (const mines of [1, 3, 5, 10, 20, 24]) {
      for (let k = 1; k <= 25 - mines; k++) {
        let survive = 1;
        for (let i = 0; i < k; i++) survive *= (25 - mines - i) / (25 - i);
        const ev = survive * (minesMultiplierBps(mines, k, 200) / BPS);
        expect(ev).toBeLessThanOrEqual(0.98 + 1e-9);
        expect(ev).toBeGreaterThan(0.98 - 0.01);
      }
    }
  });
  it("first reveal with 1 mine pays ~1.02x and grows with depth", () => {
    expect(minesMultiplierBps(1, 1, 200)).toBe(10208);
    expect(minesMultiplierBps(3, 2, 200)).toBeGreaterThan(minesMultiplierBps(3, 1, 200));
    expect(minesMultiplierBps(3, 0, 200)).toBe(0);
  });
});

describe("crash", () => {
  it("crash point is >= 1.00x, capped at 1000x", () => {
    expect(crashPointBps(0, 200)).toBe(BPS);
    expect(crashPointBps(0.9999999, 200)).toBe(10_000_000);
  });
  it("RTP of a fixed cash-out target is ~ (1 - edge)", () => {
    const n = 200_000;
    for (const target of [15000, 20000, 50000]) {
      let paid = 0;
      for (let i = 0; i < n; i++) {
        const c = crashPointBps(floatAt("crash-rtp", "c", i, 0), 200);
        if (target < c) paid += target / BPS;
      }
      const rtp = paid / n;
      expect(rtp).toBeGreaterThan(0.94);
      expect(rtp).toBeLessThan(1.0);
    }
  });
  it("about 2% of rounds crash instantly at 1.00x", () => {
    let instant = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) if (crashPointBps(floatAt("inst", "c", i, 0), 200) === BPS) instant++;
    expect(instant / n).toBeGreaterThan(0.015);
    expect(instant / n).toBeLessThan(0.025);
  });
  it("multiplier curve and its inverse agree", () => {
    expect(crashMultiplierAt(0)).toBe(BPS);
    expect(crashMultiplierAt(-5)).toBe(BPS);
    for (const bps of [10100, 20000, 100000]) {
      const t = crashTimeFor(bps);
      expect(crashMultiplierAt(Math.ceil(t) + 2)).toBeGreaterThanOrEqual(bps);
      expect(crashMultiplierAt(Math.floor(t) - 2)).toBeLessThan(bps);
    }
  });
});
