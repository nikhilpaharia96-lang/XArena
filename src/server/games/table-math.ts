/**
 * Maths for Color Prediction, Roulette and Fortune Gems. Pure and deterministic
 * given the floats handed in. Multipliers are integer bps (10000 = 1.00x) and
 * every rounding step floors, so rounding only ever favours the house.
 *
 * In all three, the configured house edge is applied by scaling the fair payouts
 * so that long-run return-to-player is exactly (1 - edge).
 */
import { BPS } from "./math";

// ------------------------------------------------------- color prediction ---
export type ColorPick = "GREEN" | "RED" | "VIOLET" | `N${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export const COLOR_PICKS: readonly ColorPick[] = ["GREEN", "VIOLET", "RED", "N0", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9"];

/** Colours of a drawn digit: 0 is red+violet, 5 is green+violet, odd = green, even = red. */
export function colorsOf(n: number): ("GREEN" | "RED" | "VIOLET")[] {
  const out: ("GREEN" | "RED" | "VIOLET")[] = [n % 2 === 1 ? "GREEN" : "RED"];
  if (n === 0 || n === 5) out.push("VIOLET");
  return out;
}

/** Digits 0..9, each exactly 10%. */
export const colorDraw = (f: number) => Math.min(9, Math.floor(f * 10));

export function colorWins(pick: ColorPick, n: number): boolean {
  return pick.startsWith("N") ? Number(pick.slice(1)) === n : colorsOf(n).includes(pick as "GREEN" | "RED" | "VIOLET");
}

/** How many of the 10 digits win a pick: colour 5/10, violet 2/10, number 1/10. */
export const colorWinningDigits = (pick: ColorPick) => (pick === "GREEN" || pick === "RED" ? 5 : pick === "VIOLET" ? 2 : 1);

export function colorMultiplierBps(pick: ColorPick, edgeBps: number): number {
  return Math.floor(((10 / colorWinningDigits(pick)) * (BPS - edgeBps) * BPS) / BPS);
}

// ---------------------------------------------------------------- roulette ---
/** European wheel: one zero, 37 pockets. */
export const ROULETTE_POCKETS = 37;
export const ROULETTE_MAX_BETS = 20;
export const RED_NUMBERS: readonly number[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export type RouletteBetType = "STRAIGHT" | "RED" | "BLACK" | "ODD" | "EVEN" | "LOW" | "HIGH" | "DOZEN1" | "DOZEN2" | "DOZEN3" | "COL1" | "COL2" | "COL3";
export const ROULETTE_BET_TYPES: readonly RouletteBetType[] = [
  "STRAIGHT", "RED", "BLACK", "ODD", "EVEN", "LOW", "HIGH", "DOZEN1", "DOZEN2", "DOZEN3", "COL1", "COL2", "COL3",
];
export interface RouletteBet { type: RouletteBetType; number?: number; amount: number }

export const rouletteSpin = (f: number) => Math.min(36, Math.floor(f * ROULETTE_POCKETS));
export const isRed = (n: number) => RED_NUMBERS.includes(n);

export function rouletteBetWins(bet: Pick<RouletteBet, "type" | "number">, n: number): boolean {
  switch (bet.type) {
    case "STRAIGHT": return bet.number === n;
    case "RED": return n !== 0 && isRed(n);
    case "BLACK": return n !== 0 && !isRed(n);
    case "ODD": return n !== 0 && n % 2 === 1;
    case "EVEN": return n !== 0 && n % 2 === 0;
    case "LOW": return n >= 1 && n <= 18;
    case "HIGH": return n >= 19 && n <= 36;
    case "DOZEN1": return n >= 1 && n <= 12;
    case "DOZEN2": return n >= 13 && n <= 24;
    case "DOZEN3": return n >= 25 && n <= 36;
    case "COL1": return n !== 0 && n % 3 === 1;
    case "COL2": return n !== 0 && n % 3 === 2;
    case "COL3": return n !== 0 && n % 3 === 0;
  }
}

/** Standard "x to 1" odds for the bet type. */
export function rouletteOdds(type: RouletteBetType): number {
  if (type === "STRAIGHT") return 35;
  if (type.startsWith("DOZEN") || type.startsWith("COL")) return 2;
  return 1;
}

/** Total-return multiplier. The wheel's own edge is 1/37; this rescales payouts to the configured edge (270 bps = classic). */
export function rouletteMultiplierBps(type: RouletteBetType, edgeBps: number): number {
  return Math.floor(((rouletteOdds(type) + 1) * (BPS - edgeBps) * ROULETTE_POCKETS) / 36);
}

export function rouletteValidate(bets: RouletteBet[]): string | null {
  if (!Array.isArray(bets) || bets.length === 0) return "Place at least one chip.";
  if (bets.length > ROULETTE_MAX_BETS) return `At most ${ROULETTE_MAX_BETS} bets per spin.`;
  for (const b of bets) {
    if (!ROULETTE_BET_TYPES.includes(b.type)) return "Unknown bet type.";
    if (!Number.isSafeInteger(b.amount) || b.amount <= 0) return "Enter a valid chip amount.";
    if (b.type === "STRAIGHT" && !(Number.isInteger(b.number) && (b.number as number) >= 0 && (b.number as number) <= 36)) return "Pick a number from 0 to 36.";
  }
  return null;
}

export function roulettePayout(bets: RouletteBet[], n: number, edgeBps: number): number {
  let total = 0;
  for (const b of bets) if (rouletteBetWins(b, n)) total += Math.floor((b.amount * rouletteMultiplierBps(b.type, edgeBps)) / BPS);
  return total;
}

/** Largest payout any single spin could produce for this layout (for the table limit). */
export function rouletteWorstCase(bets: RouletteBet[], edgeBps: number): number {
  let worst = 0;
  for (let n = 0; n < ROULETTE_POCKETS; n++) worst = Math.max(worst, roulettePayout(bets, n, edgeBps));
  return worst;
}

// ------------------------------------------------------------ fortune gems ---
export const GEM_NAMES = ["Diamond", "Ruby", "Emerald", "Sapphire", "Amethyst", "Citrine"] as const;
export const GEM_WEIGHTS = [1, 2, 3, 4, 5, 6] as const;
const GEM_TOTAL = GEM_WEIGHTS.reduce((a, b) => a + b, 0);
/** Base (pre-edge) pays as bps of the line bet: first two reels match / all three match. */
export const GEM_PAIR_BPS = [60_000, 40_000, 30_000, 20_000, 15_000, 10_000] as const;
export const GEM_TRIPLE_BPS = [4_000_000, 1_200_000, 400_000, 200_000, 100_000, 50_000] as const;
export const GEM_ROWS = 3;
export const GEM_REELS = 3;

/** Exact return of the base paytable (fraction, not bps). */
export const GEM_BASE_RTP = (() => {
  let r = 0;
  for (let i = 0; i < GEM_WEIGHTS.length; i++) {
    const p = GEM_WEIGHTS[i] / GEM_TOTAL;
    r += p * p * (1 - p) * (GEM_PAIR_BPS[i] / BPS) + p ** 3 * (GEM_TRIPLE_BPS[i] / BPS);
  }
  return r;
})();

/** Scales a base pay so the whole game returns exactly (1 - edge). */
export const gemScale = (edgeBps: number) => (1 - edgeBps / BPS) / GEM_BASE_RTP;
export const gemTripleMultBps = (gem: number, edgeBps: number) => Math.floor(GEM_TRIPLE_BPS[gem] * gemScale(edgeBps));
export const gemPairMultBps = (gem: number, edgeBps: number) => Math.floor(GEM_PAIR_BPS[gem] * gemScale(edgeBps));

export function gemDraw(f: number): number {
  let t = Math.min(GEM_TOTAL - 1, Math.floor(f * GEM_TOTAL));
  for (let i = 0; i < GEM_WEIGHTS.length; i++) {
    if (t < GEM_WEIGHTS[i]) return i;
    t -= GEM_WEIGHTS[i];
  }
  return GEM_WEIGHTS.length - 1;
}

export interface GemRowWin { row: number; gem: number; count: 2 | 3; multBps: number }

/** grid[row][reel]. Each of the three rows is its own payline, worth a third of the bet. */
export function gemEvaluate(grid: number[][], edgeBps: number): { wins: GemRowWin[]; totalMultBps: number } {
  const wins: GemRowWin[] = [];
  let sum = 0;
  grid.forEach((row, r) => {
    if (row[0] !== row[1]) return;
    const count = row[2] === row[0] ? 3 : 2;
    const multBps = count === 3 ? gemTripleMultBps(row[0], edgeBps) : gemPairMultBps(row[0], edgeBps);
    wins.push({ row: r, gem: row[0], count, multBps });
    sum += multBps;
  });
  return { wins, totalMultBps: Math.floor(sum / GEM_ROWS) };
}

/** Best case: every row a top triple. */
export const gemMaxMultBps = (edgeBps: number) => gemTripleMultBps(0, edgeBps);
