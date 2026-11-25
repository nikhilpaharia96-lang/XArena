/**
 * DEMO ONLY: virtual points, no wallet, no API, no database, no real money.
 * Pure logic for the "Color Prediction" demo so it can be unit-tested.
 */

export type Color = "green" | "red" | "violet";
export type Size = "big" | "small";

export type Bet =
  | { kind: "color"; color: Color }
  | { kind: "number"; n: number }
  | { kind: "size"; size: Size };

export const ROUND_SECONDS = 30;
export const LOCK_SECONDS = 5;
export const START_POINTS = 1000;

/** 0 = red+violet, 5 = green+violet, odd = green, even = red. */
export function colorsOf(n: number): Color[] {
  if (n === 0) return ["red", "violet"];
  if (n === 5) return ["green", "violet"];
  return n % 2 === 1 ? ["green"] : ["red"];
}

export function sizeOf(n: number): Size {
  return n >= 5 ? "big" : "small";
}

export function betLabel(b: Bet): string {
  if (b.kind === "color") return b.color[0].toUpperCase() + b.color.slice(1);
  if (b.kind === "size") return b.size === "big" ? "Big" : "Small";
  return `Number ${b.n}`;
}

/** Total virtual points returned for a bet (0 on a loss). Stake is already deducted. */
export function payout(bet: Bet, stake: number, result: number): number {
  if (bet.kind === "number") return bet.n === result ? Math.floor(stake * 9) : 0;
  if (bet.kind === "size") return sizeOf(result) === bet.size ? stake * 2 : 0;
  if (!colorsOf(result).includes(bet.color)) return 0;
  if (bet.color === "violet") return Math.floor(stake * 4.5);
  // Green/Red on a mixed number (0 or 5) pays less.
  const mixed = result === 0 || result === 5;
  return mixed ? Math.floor(stake * 1.5) : stake * 2;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSeed(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Result digit 0-9 derived from the (previously committed) seed and the round id. */
export async function resultFromSeed(seed: string, roundId: string): Promise<number> {
  const h = await sha256Hex(`${seed}:${roundId}`);
  return parseInt(h.slice(0, 8), 16) % 10;
}
