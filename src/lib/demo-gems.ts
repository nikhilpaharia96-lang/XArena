/**
 * DEMO ONLY: virtual points, no wallet, no API, no database, no real money.
 * Pure logic for the "Fortune Gems" 3x3 slot demo (5 paylines, wild substitutes).
 */
import { sha256Hex } from "./demo-color-game";

export type Sym = "diamond" | "amethyst" | "topaz" | "emerald" | "sapphire" | "ruby" | "wild";
export const SYMBOLS: Sym[] = ["diamond", "amethyst", "topaz", "emerald", "sapphire", "ruby", "wild"];

/** Relative frequency of each symbol on every cell. */
export const WEIGHTS: Record<Sym, number> = { diamond: 2, amethyst: 3, topaz: 5, emerald: 7, sapphire: 10, ruby: 12, wild: 4 };
/** Payout multiplier of the per-line bet for 3 matching symbols on a payline. */
export const PAY: Record<Sym, number> = { diamond: 50, amethyst: 25, topaz: 15, emerald: 10, sapphire: 6, ruby: 4, wild: 100 };

export const NAMES: Record<Sym, string> = { diamond: "Diamond", amethyst: "Amethyst", topaz: "Topaz", emerald: "Emerald", sapphire: "Sapphire", ruby: "Ruby", wild: "Wild" };

/** Grid is row-major, 3 rows x 3 reels: index = row * 3 + reel. */
export const LINES: number[][] = [
  [0, 1, 2], // top
  [3, 4, 5], // middle
  [6, 7, 8], // bottom
  [0, 4, 8], // diagonal down
  [6, 4, 2], // diagonal up
];
export const LINE_COUNT = LINES.length;
export const BETS = [5, 10, 25, 50, 100, 250, 500];
const TOTAL = SYMBOLS.reduce((s, k) => s + WEIGHTS[k], 0);

export function symbolFromRoll(roll: number): Sym {
  let r = roll % TOTAL;
  for (const s of SYMBOLS) {
    if (r < WEIGHTS[s]) return s;
    r -= WEIGHTS[s];
  }
  return "ruby";
}

/** 9 cells from a SHA-256 hex digest (5 hex chars per cell). */
export function gridFromHash(hex: string): Sym[] {
  return Array.from({ length: 9 }, (_, i) => symbolFromRoll(parseInt(hex.slice(i * 5, i * 5 + 5), 16)));
}

export async function spinGrid(seed: string, roundId: string): Promise<Sym[]> {
  return gridFromHash(await sha256Hex(`${seed}:${roundId}`));
}

export interface LineWin { line: number; symbol: Sym; mult: number; amount: number; cells: number[] }

export function lineBetOf(bet: number): number {
  return bet / LINE_COUNT;
}

/** Wild substitutes for any gem. Three wilds pay the Wild amount. */
export function evaluate(grid: Sym[], bet: number): { wins: LineWin[]; total: number } {
  const lb = lineBetOf(bet);
  const wins: LineWin[] = [];
  LINES.forEach((cells, line) => {
    const syms = cells.map((c) => grid[c]);
    const gems = syms.filter((s) => s !== "wild");
    let symbol: Sym | null = null;
    if (gems.length === 0) symbol = "wild";
    else if (gems.every((g) => g === gems[0])) symbol = gems[0];
    if (symbol) wins.push({ line, symbol, mult: PAY[symbol], amount: Math.floor(lb * PAY[symbol]), cells });
  });
  return { wins, total: wins.reduce((s, w) => s + w.amount, 0) };
}

/** Exact return-to-player: every line has 3 independent cells, so E[total]/bet = E[one line multiplier]. */
export function theoreticalRtp(): number {
  const p = (s: Sym) => WEIGHTS[s] / TOTAL;
  const pw = p("wild");
  let r = PAY.wild * pw ** 3;
  for (const s of SYMBOLS) if (s !== "wild") r += PAY[s] * ((p(s) + pw) ** 3 - pw ** 3);
  return r;
}
