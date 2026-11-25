/**
 * DEMO ONLY: virtual points, no wallet, no API, no database, no real money.
 * Pure logic for the European roulette demo (single zero, 37 pockets).
 */
import { sha256Hex } from "./demo-color-game";

/** Physical pocket order of a European wheel, clockwise starting at 0. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export type RColor = "red" | "black" | "green";

export function colorOf(n: number): RColor {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

/**
 * Bet keys: "n:17" straight, "red" "black" "odd" "even" "low" (1-18) "high" (19-36),
 * "d1" "d2" "d3" dozens, "c1" "c2" "c3" columns.
 */
export function betLabel(key: string): string {
  if (key.startsWith("n:")) return `Number ${key.slice(2)}`;
  const m: Record<string, string> = { red: "Red", black: "Black", odd: "Odd", even: "Even", low: "1-18", high: "19-36", d1: "1st 12", d2: "2nd 12", d3: "3rd 12", c1: "Column 1", c2: "Column 2", c3: "Column 3" };
  return m[key] ?? key;
}

/** Total virtual points returned for a bet, stake included (0 on a loss). */
export function betReturn(key: string, stake: number, n: number): number {
  if (key.startsWith("n:")) return Number(key.slice(2)) === n ? stake * 36 : 0;
  const nz = n > 0;
  switch (key) {
    case "red": return colorOf(n) === "red" ? stake * 2 : 0;
    case "black": return colorOf(n) === "black" ? stake * 2 : 0;
    case "odd": return nz && n % 2 === 1 ? stake * 2 : 0;
    case "even": return nz && n % 2 === 0 ? stake * 2 : 0;
    case "low": return n >= 1 && n <= 18 ? stake * 2 : 0;
    case "high": return n >= 19 ? stake * 2 : 0;
    case "d1": return n >= 1 && n <= 12 ? stake * 3 : 0;
    case "d2": return n >= 13 && n <= 24 ? stake * 3 : 0;
    case "d3": return n >= 25 ? stake * 3 : 0;
    case "c1": return nz && n % 3 === 1 ? stake * 3 : 0;
    case "c2": return nz && n % 3 === 2 ? stake * 3 : 0;
    case "c3": return nz && n % 3 === 0 ? stake * 3 : 0;
    default: return 0;
  }
}

/** Winning pocket 0-36 from the (previously committed) seed and round id. */
export async function rouletteResult(seed: string, roundId: string): Promise<number> {
  const h = await sha256Hex(`${seed}:${roundId}`);
  return parseInt(h.slice(0, 8), 16) % 37;
}
