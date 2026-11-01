/**
 * Pure game maths. No I/O, fully deterministic given the floats it is handed.
 * Multipliers are integer "bps": 10000 = 1.00x. Every rounding step floors, so
 * rounding can only ever favour the house, never the player.
 */

export const BPS = 10_000;

export const GAME_KEYS = ["DICE", "COINFLIP", "MINES", "CRASH"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

/** floor(stake * multBps / 10000) using BigInt so large stake x multiplier can never lose precision. */
export function payoutFor(stakePaise: number, multBps: number): number {
  return Number((BigInt(stakePaise) * BigInt(multBps)) / BigInt(BPS));
}

// ---------------------------------------------------------------- dice -----
export const DICE_MIN_CHANCE_BPS = 100; //  1.00 %
export const DICE_MAX_CHANCE_BPS = 9_500; // 95.00 %

export type DiceDirection = "UNDER" | "OVER";

export function diceMultiplierBps(chanceBps: number, edgeBps: number): number {
  return Math.floor(((BPS - edgeBps) * BPS) / chanceBps);
}

/** roll is an integer 0..9999 (two implied decimals: 0.00 .. 99.99). */
export function diceRoll(f: number): number {
  return Math.floor(f * BPS);
}

export function diceWins(roll: number, direction: DiceDirection, chanceBps: number): boolean {
  return direction === "UNDER" ? roll < chanceBps : roll >= BPS - chanceBps;
}

// ----------------------------------------------------------- coin flip -----
export type CoinSide = "HEADS" | "TAILS";

export const coinMultiplierBps = (edgeBps: number) => 2 * (BPS - edgeBps);
export const coinFlip = (f: number): CoinSide => (f < 0.5 ? "HEADS" : "TAILS");

// --------------------------------------------------------------- mines -----
export const MINES_TILES = 25;
export const MINES_MIN = 1;
export const MINES_MAX = 24;

/** Fisher-Yates over 0..24; the first `mines` entries of the shuffle are the mine tiles. */
export function minePositions(next: () => number, mines: number): number[] {
  const tiles = Array.from({ length: MINES_TILES }, (_, i) => i);
  for (let i = MINES_TILES - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, mines).sort((a, b) => a - b);
}

/** Multiplier after `safe` safe reveals: (1 - edge) * prod (25-i) / (25-mines-i). */
export function minesMultiplierBps(mines: number, safe: number, edgeBps: number): number {
  if (safe <= 0) return 0;
  let m = (BPS - edgeBps) / BPS;
  for (let i = 0; i < safe; i++) m *= (MINES_TILES - i) / (MINES_TILES - mines - i);
  return Math.floor(m * BPS);
}

// --------------------------------------------------------------- crash -----
export const CRASH_MAX_BPS = 10_000_000; // 1000.00x hard cap
export const CRASH_RATE_PER_SEC = 0.08; // multiplier = e^(0.08 * seconds)
export const CRASH_MIN_AUTO_BPS = 10_100; // 1.01x

/** P(crashPoint >= x) = (1 - edge) / x. Returns bps, minimum 10000 (instant crash). */
export function crashPointBps(f: number, edgeBps: number): number {
  const x = (1 - edgeBps / BPS) / (1 - f);
  return Math.min(CRASH_MAX_BPS, Math.max(BPS, Math.floor(x * BPS)));
}

export function crashMultiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0) return BPS;
  return Math.floor(BPS * Math.exp((CRASH_RATE_PER_SEC * elapsedMs) / 1000));
}

/** Milliseconds from round start until the multiplier reaches `bps`. */
export function crashTimeFor(bps: number): number {
  return (Math.log(bps / BPS) / CRASH_RATE_PER_SEC) * 1000;
}
