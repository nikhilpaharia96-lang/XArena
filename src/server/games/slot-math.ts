/**
 * "Garuda Ascent" - original 5x3 slot, 10 fixed paylines. Pure maths, no I/O.
 *
 * Symbols (index = SYMBOLS position):
 *   0 LOTUS 1 CONCH 2 BELL 3 CHAKRA 4 FEATHER 5 GARUDA(top pay) 6 WILD(sun disc) 7 SCATTER(temple)
 * Wild substitutes for every symbol except SCATTER and only lands on reels 2-4.
 * 3+ scatters anywhere start the free-spin round: every winning free spin
 * raises the "Ascent" multiplier (x1 -> x5), further scatters add spins.
 *
 * All payouts are expressed in "units" = 1/10 of the total bet (= one line bet),
 * then converted to paise with floor(), so rounding never favours the player.
 */

export const SLOT_REELS = 5;
export const SLOT_ROWS = 3;
export const SLOT_LINES = 10;

export const SYMBOLS = ["LOTUS", "CONCH", "BELL", "CHAKRA", "FEATHER", "GARUDA", "WILD", "SCATTER"] as const;
export type SlotSymbol = (typeof SYMBOLS)[number];
export const WILD = 6;
export const SCATTER = 7;

/** Payline row (0 top .. 2 bottom) for each reel. */
export const PAYLINES: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 0, 1, 0],
];

/** Pay per line in line-bet units for 3 / 4 / 5 of a kind. */
export const PAYTABLE: readonly (readonly [number, number, number])[] = [
  [5, 16, 40], // LOTUS
  [5, 16, 52], // CONCH
  [8, 26, 78], // BELL
  [13, 39, 130], // CHAKRA
  [21, 72, 260], // FEATHER
  [39, 156, 610], // GARUDA
];

/** Scatter pays in TOTAL-bet multiples (x10 to get units) for 3 / 4 / 5. */
export const SCATTER_PAY_TOTAL = [2, 10, 50] as const;
export const FREE_SPINS_AWARD = [8, 12, 16] as const; // for 3 / 4 / 5 scatters
export const RETRIGGER_SPINS = 5;
export const MAX_FREE_SPINS = 30;
export const MAX_ASCENT = 5;

// Symbol counts per reel strip (strip length is the sum of a column).
const STRIP_COUNTS: readonly (readonly number[])[] = [
  //  LOTUS CONCH BELL CHAKRA FEATHER GARUDA WILD SCATTER
  [8, 7, 6, 5, 4, 3, 0, 1],
  [8, 7, 6, 5, 4, 3, 2, 2],
  [8, 7, 6, 5, 4, 3, 2, 1],
  [8, 7, 6, 5, 4, 3, 2, 2],
  [8, 7, 6, 5, 4, 3, 0, 1],
];

/** Deterministic spread so the same symbols are not clustered on a strip. */
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

export const STRIPS: readonly (readonly number[])[] = STRIP_COUNTS.map((c, i) => buildStrip(c, 7919 * (i + 1)));

/** grid[reel][row] */
export type Grid = number[][];

export function gridFromStops(stops: readonly number[]): Grid {
  return stops.map((stop, reel) => {
    const strip = STRIPS[reel];
    return [0, 1, 2].map((row) => strip[(stop + row) % strip.length]);
  });
}

export interface LineWin {
  line: number;
  symbol: number;
  count: number;
  units: number;
}

export function evaluateGrid(grid: Grid): { lineWins: LineWin[]; lineUnits: number; scatters: number } {
  const lineWins: LineWin[] = [];
  for (let l = 0; l < PAYLINES.length; l++) {
    const rows = PAYLINES[l];
    const first = grid[0][rows[0]];
    if (first === SCATTER || first === WILD) continue;
    let count = 1;
    for (let r = 1; r < SLOT_REELS; r++) {
      const s = grid[r][rows[r]];
      if (s === first || s === WILD) count++;
      else break;
    }
    if (count >= 3) lineWins.push({ line: l, symbol: first, count, units: PAYTABLE[first][count - 3] });
  }
  let scatters = 0;
  for (const col of grid) for (const s of col) if (s === SCATTER) scatters++;
  return { lineWins, lineUnits: lineWins.reduce((a, w) => a + w.units, 0), scatters };
}

export interface SpinStep {
  free: boolean;
  stops: number[];
  grid: Grid;
  lineWins: LineWin[];
  scatters: number;
  /** Ascent multiplier applied to this spin (1 in the base game). */
  ascent: number;
  /** Units won on this spin AFTER the ascent multiplier (before RTP scaling). */
  units: number;
  /** Free spins awarded by this spin (0 if none). */
  awarded: number;
}

export interface SlotOutcome {
  steps: SpinStep[];
  totalUnits: number;
  freeSpinsTriggered: boolean;
}

function spinOnce(next: () => number, free: boolean, ascent: number): SpinStep {
  const stops = STRIPS.map((strip) => Math.floor(next() * strip.length));
  const grid = gridFromStops(stops);
  const { lineWins, lineUnits, scatters } = evaluateGrid(grid);
  const scatterUnits = scatters >= 3 ? SCATTER_PAY_TOTAL[Math.min(scatters, 5) - 3] * SLOT_LINES : 0;
  const awarded = scatters >= 3 ? (free ? RETRIGGER_SPINS : FREE_SPINS_AWARD[Math.min(scatters, 5) - 3]) : 0;
  return { free, stops, grid, lineWins, scatters, ascent, units: (lineUnits + scatterUnits) * ascent, awarded };
}

/** One paid spin plus (if triggered) its whole free-spin round. */
export function playSlot(next: () => number): SlotOutcome {
  const steps: SpinStep[] = [];
  const base = spinOnce(next, false, 1);
  steps.push(base);
  let total = base.units;
  let triggered = false;
  if (base.awarded > 0) {
    triggered = true;
    let left = base.awarded;
    let played = 0;
    let ascent = 1;
    while (left > 0 && played < MAX_FREE_SPINS) {
      const st = spinOnce(next, true, ascent);
      played++;
      left--;
      if (st.awarded > 0) left = Math.min(left + st.awarded, MAX_FREE_SPINS - played);
      steps.push(st);
      total += st.units;
      if (st.lineWins.length > 0) ascent = Math.min(MAX_ASCENT, ascent + 1);
    }
  }
  return { steps, totalUnits: total, freeSpinsTriggered: triggered };
}

/**
 * Raw RTP of the paytable (set by simulation, see slot-math.test.ts). The admin
 * "house edge" scales payouts around it: edge = 10000 - SLOT_BASE_RTP_BPS (=530) is neutral.
 */
export const SLOT_BASE_RTP_BPS = 9_470; // measured: 8M simulated rounds = 94.73% (+/-0.3%)

/** units -> paise: floor(stake * units / 10 * (10000 - edge) / baseRtp). BigInt, floors only. */
export function unitsToPaise(stake: number, units: number, edgeBps: number): number {
  const num = BigInt(stake) * BigInt(units) * BigInt(10_000 - edgeBps);
  const den = BigInt(10) * BigInt(SLOT_BASE_RTP_BPS);
  return Number(num / den);
}
