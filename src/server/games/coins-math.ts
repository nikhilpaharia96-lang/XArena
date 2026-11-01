/**
 * "Lakshmi Coins" - original 5x3 slot: 243 ways to win + a Coin Respin bonus.
 * Pure maths, no I/O. Everything is expressed in "units" = 1/20 of the total bet,
 * converted to paise with floor() so rounding never favours the player.
 *
 * Symbols: 0 DIYA 1 BANGLE 2 COCONUT 3 KALASH 4 ELEPHANT 5 CROWN 6 WILD(lotus) 7 COIN
 * - Ways: a symbol pays from reel 1 on adjacent reels; ways = product of matching cells per reel.
 *   Wild (reels 2-4) substitutes for every paying symbol, never for COIN.
 * - Bonus: 6+ COIN symbols on the grid lock in place with cash values. 3 respins; every new coin
 *   resets respins to 3. Fill all 15 cells for the grand bonus.
 */

export const COIN_REELS = 5;
export const COIN_ROWS = 3;
export const COIN_CELLS = 15;
export const COIN_WILD = 6;
export const COIN = 7;
export const COIN_TRIGGER = 6;
export const COIN_RESPINS = 3;
export const UNITS_PER_BET = 20;

export const COIN_SYMBOLS = ["DIYA", "BANGLE", "COCONUT", "KALASH", "ELEPHANT", "CROWN", "WILD", "COIN"] as const;

/** Units per way for 3 / 4 / 5 reels. */
export const WAYS_PAY: readonly (readonly [number, number, number])[] = [
  [3, 6, 15], // DIYA
  [3, 6, 19], // BANGLE
  [4, 10, 26], // COCONUT
  [6, 15, 48], // KALASH
  [10, 26, 85], // ELEPHANT
  [15, 48, 190], // CROWN
];

const STRIP_COUNTS: readonly (readonly number[])[] = [
  //  DIYA BANGLE COCONUT KALASH ELEPHANT CROWN WILD COIN
  [9, 8, 7, 5, 4, 3, 0, 5],
  [9, 8, 7, 5, 4, 3, 2, 5],
  [9, 8, 7, 5, 4, 3, 2, 5],
  [9, 8, 7, 5, 4, 3, 2, 5],
  [9, 8, 7, 5, 4, 3, 0, 5],
];

function buildStrip(counts: readonly number[], seed: number): number[] {
  const bag: number[] = [];
  counts.forEach((n, sym) => {
    for (let i = 0; i < n; i++) bag.push(sym);
  });
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export const COIN_STRIPS: readonly (readonly number[])[] = STRIP_COUNTS.map((c, i) => buildStrip(c, 104729 * (i + 3)));

/** grid[reel][row] */
export type CoinGrid = number[][];

export function coinGridFromStops(stops: readonly number[]): CoinGrid {
  return stops.map((stop, reel) => {
    const strip = COIN_STRIPS[reel];
    return [0, 1, 2].map((row) => strip[(stop + row) % strip.length]);
  });
}

export interface WaysWin {
  symbol: number;
  reels: number; // 3..5
  ways: number;
  units: number;
}

export function evaluateWays(grid: CoinGrid): { wins: WaysWin[]; units: number } {
  const wins: WaysWin[] = [];
  for (let sym = 0; sym <= 5; sym++) {
    let ways = 1;
    let reels = 0;
    for (let r = 0; r < COIN_REELS; r++) {
      const n = grid[r].filter((s) => s === sym || s === COIN_WILD).length;
      if (n === 0) break;
      ways *= n;
      reels++;
    }
    if (reels >= 3) wins.push({ symbol: sym, reels, ways, units: WAYS_PAY[sym][reels - 3] * ways });
  }
  return { wins, units: wins.reduce((a, w) => a + w.units, 0) };
}

/** Coin cash values in units (20 units = 1x total bet) with weights. Jackpot coins carry a label. */
export interface CoinValue {
  units: number;
  label?: "MINI" | "MINOR";
  weight: number;
}
export const COIN_VALUES: readonly CoinValue[] = [
  { units: 10, weight: 30 }, // 0.5x
  { units: 20, weight: 28 }, // 1x
  { units: 30, weight: 16 },
  { units: 40, weight: 10 },
  { units: 60, weight: 7 },
  { units: 100, weight: 4 }, // 5x
  { units: 200, weight: 2.5 }, // 10x
  { units: 500, weight: 1.2 }, // 25x
  { units: 1000, label: "MINI", weight: 0.8 }, // 50x
  { units: 3000, label: "MINOR", weight: 0.25 }, // 150x
];
const TOTAL_W = COIN_VALUES.reduce((a, v) => a + v.weight, 0);
export const GRAND_UNITS = 10_000; // 500x total bet for filling all 15 cells
/** Chance that an empty cell turns into a coin on a respin. */
export const RESPIN_COIN_CHANCE = 0.1;

export interface CoinChip {
  cell: number; // reel * 3 + row
  units: number;
  label?: "MINI" | "MINOR";
}

function drawValue(next: () => number): CoinValue {
  let x = next() * TOTAL_W;
  for (const v of COIN_VALUES) {
    x -= v.weight;
    if (x < 0) return v;
  }
  return COIN_VALUES[0];
}

export interface RespinRound {
  newCoins: CoinChip[];
  respinsLeft: number;
}

export interface CoinBonus {
  initial: CoinChip[];
  rounds: RespinRound[];
  full: boolean;
  coinUnits: number;
  grandUnits: number;
}

export interface CoinsOutcome {
  stops: number[];
  grid: CoinGrid;
  ways: WaysWin[];
  waysUnits: number;
  coinCount: number;
  bonus: CoinBonus | null;
  totalUnits: number;
}

export function playCoins(next: () => number): CoinsOutcome {
  const stops = COIN_STRIPS.map((s) => Math.floor(next() * s.length));
  const grid = coinGridFromStops(stops);
  const { wins, units } = evaluateWays(grid);
  const coinCells: number[] = [];
  grid.forEach((col, r) => col.forEach((s, row) => s === COIN && coinCells.push(r * 3 + row)));

  let bonus: CoinBonus | null = null;
  if (coinCells.length >= COIN_TRIGGER) {
    const locked = new Map<number, CoinChip>();
    const initial: CoinChip[] = coinCells.map((cell) => {
      const v = drawValue(next);
      const chip: CoinChip = { cell, units: v.units, ...(v.label ? { label: v.label } : {}) };
      locked.set(cell, chip);
      return chip;
    });
    const rounds: RespinRound[] = [];
    let left = COIN_RESPINS;
    while (left > 0 && locked.size < COIN_CELLS) {
      left--;
      const fresh: CoinChip[] = [];
      for (let cell = 0; cell < COIN_CELLS; cell++) {
        if (locked.has(cell)) continue;
        if (next() < RESPIN_COIN_CHANCE) {
          const v = drawValue(next);
          const chip: CoinChip = { cell, units: v.units, ...(v.label ? { label: v.label } : {}) };
          locked.set(cell, chip);
          fresh.push(chip);
        }
      }
      if (fresh.length > 0) left = COIN_RESPINS;
      rounds.push({ newCoins: fresh, respinsLeft: left });
    }
    const full = locked.size === COIN_CELLS;
    const coinUnits = [...locked.values()].reduce((a, c) => a + c.units, 0);
    bonus = { initial, rounds, full, coinUnits, grandUnits: full ? GRAND_UNITS : 0 };
  }
  const bonusUnits = bonus ? bonus.coinUnits + bonus.grandUnits : 0;
  return { stops, grid, ways: wins, waysUnits: units, coinCount: coinCells.length, bonus, totalUnits: units + bonusUnits };
}

/** Measured by simulation; neutral admin edge = 10000 - this (605). */
export const COINS_BASE_RTP_BPS = 9_395; // measured: 10M simulated rounds = 93.95% (+/-0.5%)

/** units -> paise: floor(stake * units / 20 * (10000 - edge) / baseRtp). BigInt, floors only. */
export function coinUnitsToPaise(stake: number, units: number, edgeBps: number): number {
  const num = BigInt(stake) * BigInt(units) * BigInt(10_000 - edgeBps);
  const den = BigInt(UNITS_PER_BET) * BigInt(COINS_BASE_RTP_BPS);
  return Number(num / den);
}
