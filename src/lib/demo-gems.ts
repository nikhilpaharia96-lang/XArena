/**
 * DEMO ONLY: virtual points, no wallet, no API, no database, no real money.
 * Pure logic for the "Fortune Gems" demo slot: 3x3 gems, 5 paylines, wild substitutes,
 * plus a 4th "win multiplier" reel (middle cell applies to any win) and an "Extra Bets" mode.
 */
import { sha256Hex } from "./demo-color-game";

export type Sym = "diamond" | "amethyst" | "topaz" | "emerald" | "sapphire" | "ruby" | "wild";
export const SYMBOLS: Sym[] = ["diamond", "amethyst", "topaz", "emerald", "sapphire", "ruby", "wild"];

/** Relative frequency of each symbol on every cell. */
export const WEIGHTS: Record<Sym, number> = { diamond: 2, amethyst: 3, topaz: 5, emerald: 7, sapphire: 10, ruby: 12, wild: 4 };
/** Payout multiplier of the per-line bet for 3 matching symbols on a payline (before the win multiplier). */
export const PAY: Record<Sym, number> = { diamond: 20, amethyst: 12, topaz: 6, emerald: 5, sapphire: 3, ruby: 1, wild: 40 };
export const NAMES: Record<Sym, string> = { diamond: "Diamond", amethyst: "Amethyst", topaz: "Topaz", emerald: "Emerald", sapphire: "Sapphire", ruby: "Ruby", wild: "Wild" };

/** Win multiplier reel: weights per multiplier value. Extra Bets removes 1x and shifts odds upward. */
export const MULT_WEIGHTS_BASE: Record<number, number> = { 1: 50, 2: 25, 3: 12, 5: 7, 10: 4, 15: 2 };
export const MULT_WEIGHTS_EXTRA: Record<number, number> = { 2: 52, 3: 26, 5: 12, 8: 5, 15: 4, 20: 1 };
export const EXTRA_BET_FACTOR = 1.5;

/** Grid is row-major, 3 rows x 3 reels: index = row * 3 + reel. */
export const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 4, 8],
  [6, 4, 2],
];
export const LINE_COUNT = LINES.length;
export const BETS = [10, 20, 50, 100, 200, 500];
const TOTAL = SYMBOLS.reduce((s, k) => s + WEIGHTS[k], 0);

export function totalCost(bet: number, extra: boolean): number {
  return extra ? Math.round(bet * EXTRA_BET_FACTOR) : bet;
}

export function symbolFromRoll(roll: number): Sym {
  let r = roll % TOTAL;
  for (const s of SYMBOLS) {
    if (r < WEIGHTS[s]) return s;
    r -= WEIGHTS[s];
  }
  return "ruby";
}

export function multiplierFromRoll(roll: number, extra: boolean): number {
  const w = extra ? MULT_WEIGHTS_EXTRA : MULT_WEIGHTS_BASE;
  const entries = Object.entries(w).map(([k, v]) => [Number(k), v] as const);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = roll % total;
  for (const [m, v] of entries) {
    if (r < v) return m;
    r -= v;
  }
  return entries[0][0];
}

export interface Spin { grid: Sym[]; mults: number[] } // mults: 3 cells top to bottom; the middle one is active

/** 9 gem cells (5 hex chars each) then 3 multiplier cells from one SHA-256 digest. */
export function spinFromHash(hex: string, extra: boolean): Spin {
  const grid = Array.from({ length: 9 }, (_, i) => symbolFromRoll(parseInt(hex.slice(i * 5, i * 5 + 5), 16)));
  const mults = Array.from({ length: 3 }, (_, i) => multiplierFromRoll(parseInt(hex.slice(45 + i * 5, 50 + i * 5), 16), extra));
  return { grid, mults };
}

export async function spinRound(seed: string, roundId: string, extra: boolean): Promise<Spin> {
  return spinFromHash(await sha256Hex(`${seed}:${roundId}`), extra);
}

export interface LineWin { line: number; symbol: Sym; mult: number; amount: number; cells: number[] }

export function lineBetOf(bet: number): number {
  return bet / LINE_COUNT;
}

/** Wild substitutes for any gem. The active win multiplier applies to the sum of all line wins. */
export function evaluate(grid: Sym[], bet: number, winMult = 1): { wins: LineWin[]; base: number; total: number } {
  const lb = lineBetOf(bet);
  const wins: LineWin[] = [];
  LINES.forEach((cells, line) => {
    const gems = cells.map((c) => grid[c]).filter((s) => s !== "wild");
    let symbol: Sym | null = null;
    if (gems.length === 0) symbol = "wild";
    else if (gems.every((g) => g === gems[0])) symbol = gems[0];
    if (symbol) wins.push({ line, symbol, mult: PAY[symbol], amount: Math.floor(lb * PAY[symbol]), cells });
  });
  const base = wins.reduce((s, w) => s + w.amount, 0);
  return { wins, base, total: base > 0 ? Math.floor(base * winMult) : 0 };
}

export function meanMultiplier(extra: boolean): number {
  const w = extra ? MULT_WEIGHTS_EXTRA : MULT_WEIGHTS_BASE;
  const t = Object.values(w).reduce((s, v) => s + v, 0);
  return Object.entries(w).reduce((s, [m, v]) => s + Number(m) * v, 0) / t;
}

/** Exact RTP. Each line has 3 independent cells, so E[base win]/bet = E[one line multiplier]. The multiplier cell is independent of the gems. */
export function theoreticalRtp(extra = false): number {
  const p = (s: Sym) => WEIGHTS[s] / TOTAL;
  const pw = p("wild");
  let r = PAY.wild * pw ** 3;
  for (const s of SYMBOLS) if (s !== "wild") r += PAY[s] * ((p(s) + pw) ** 3 - pw ** 3);
  return (r * meanMultiplier(extra)) / (extra ? EXTRA_BET_FACTOR : 1);
}
