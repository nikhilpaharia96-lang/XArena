/**
 * DEMO ONLY: virtual points, no wallet, no API, no database, no real money.
 * Pure logic for the Aviator-style crash demo (testable, no React).
 */
import { sha256Hex } from "./demo-color-game";

/** Multiplier grows as e^(GROWTH * seconds). ~2x after 10.7s, ~10x after 35s. */
export const GROWTH = 0.065;
export const MAX_MULTIPLIER = 1000;
export const WAIT_SECONDS = 6;
export const CRASHED_SECONDS = 3.5;

export function multiplierAt(seconds: number): number {
  return Math.floor(Math.exp(GROWTH * Math.max(0, seconds)) * 100) / 100;
}

export function timeToReach(multiplier: number): number {
  return Math.log(multiplier) / GROWTH;
}

/** Crash point (>= 1.00) derived from the seed committed before the round. ~1% of rounds crash at 1.00x. */
export async function crashPointFromSeed(seed: string, roundId: string): Promise<number> {
  const h = await sha256Hex(`${seed}:${roundId}`);
  const r = parseInt(h.slice(0, 8), 16) / 2 ** 32; // [0, 1)
  const raw = Math.floor(99 / (1 - r)) / 100;
  return Math.min(MAX_MULTIPLIER, Math.max(1, raw));
}

export function cashOutPayout(stake: number, multiplier: number): number {
  return Math.floor(stake * multiplier);
}

export function chipClass(m: number): string {
  if (m < 2) return "text-[#34b4ff]";
  if (m < 10) return "text-[#913ef8]";
  return "text-[#c017b4]";
}
