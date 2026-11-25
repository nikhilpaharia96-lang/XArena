"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";

export type GameKey = "DICE" | "COINFLIP" | "MINES" | "CRASH" | "SLOT" | "COINS" | "COLOR" | "AVIATOR" | "ROULETTE" | "GEMS";

export type PlayMode = "DEMO" | "REAL" | "BOTH";

export interface OriginalGame {
  gameKey: GameKey;
  playMode: PlayMode;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  maxPayout: number;
}

export interface FairInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Round {
  id: string;
  game: GameKey;
  status: "ACTIVE" | "WON" | "LOST" | "VOID";
  bet: number;
  payout: number;
  multiplierBps: number;
  houseEdgeBps: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  settledAt: string | null;
  live: Record<string, unknown> | null;
  balance: number;
  replayed?: boolean;
}

export interface RevealedSeed {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  roundsPlayed: number;
  revealedAt: string;
}

export interface SlotLineWin { line: number; symbol: number; count: number; units: number }
export interface SlotStep {
  free: boolean;
  stops: number[];
  grid: number[][]; // grid[reel][row]
  lineWins: SlotLineWin[];
  scatters: number;
  ascent: number;
  awarded: number;
  win: number; // paise
}
export interface SlotResult { steps: SlotStep[]; payout: number; capped: boolean; freeSpins: boolean }

export interface CoinChipView { cell: number; label: "MINI" | "MINOR" | null; amount: number }
export interface CoinsResult {
  stops: number[];
  grid: number[][]; // grid[reel][row]
  ways: { symbol: number; reels: number; ways: number }[];
  waysWin: number;
  coinCount: number;
  coinsWin: number;
  bonus: {
    initial: CoinChipView[];
    rounds: { respinsLeft: number; newCoins: CoinChipView[] }[];
    full: boolean;
    grand: number;
  } | null;
  payout: number;
  capped: boolean;
}

export interface ColorOutcome { number: number; colors: ("GREEN" | "RED" | "VIOLET")[]; win: boolean; pick: string; multiplierBps: number }
export interface RouletteOutcome { number: number; winningBets: boolean[] }
export interface GemsOutcome { grid: number[][]; wins: { row: number; gem: number; count: 2 | 3; multBps: number }[] }
export interface DemoOutcome<T> { payout: number; result: T }
export interface RouletteChip { type: string; number?: number; amount: number }

const BASE = "/api/originals";

export function useOriginals() {
  return useQuery<{ games: OriginalGame[]; fair: FairInfo }>({
    queryKey: ["originals"],
    queryFn: () => api.get(BASE),
    staleTime: 30_000,
  });
}

export function useOriginalsHistory() {
  return useQuery<{ rounds: Round[] }>({ queryKey: ["originals-history"], queryFn: () => api.get(`${BASE}/history`), staleTime: 5_000 });
}

export function useFairness() {
  return useQuery<{ current: FairInfo; revealed: RevealedSeed[] }>({ queryKey: ["originals-fair"], queryFn: () => api.get(`${BASE}/fair`) });
}

/** A fresh idempotency key per click; a retry of the SAME click (network blip) reuses it. */
export function newRequestId(): string {
  const c = globalThis.crypto;
  return c?.randomUUID ? c.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useRefreshMoney() {
  const qc = useQueryClient();
  return (roundSettled = true) => {
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    if (roundSettled) {
      qc.invalidateQueries({ queryKey: ["originals-history"] });
      qc.invalidateQueries({ queryKey: ["originals"] });
    }
  };
}

export function errMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.";
}

export function toastError(e: unknown) {
  toast({ title: "Couldn't place that", description: errMessage(e), tone: "error" });
}

export const originals = {
  dice: (b: { bet: number; direction: "UNDER" | "OVER"; chanceBps: number; requestId: string }) => api.post<Round>(`${BASE}/dice`, b),
  slot: (b: { bet: number; requestId: string }) => api.post<Round>(`${BASE}/slot`, b),
  slotDemo: (bet: number) => api.post<SlotResult>(`${BASE}/slot/demo`, { bet }),
  coins: (b: { bet: number; requestId: string }) => api.post<Round>(`${BASE}/coins`, b),
  coinsDemo: (bet: number) => api.post<CoinsResult>(`${BASE}/coins/demo`, { bet }),
  coin: (b: { bet: number; pick: "HEADS" | "TAILS"; requestId: string }) => api.post<Round>(`${BASE}/coin`, b),
  minesStart: (b: { bet: number; mines: number; requestId: string }) => api.post<Round>(`${BASE}/mines/start`, b),
  minesReveal: (tile: number) => api.post<Round>(`${BASE}/mines/reveal`, { tile }),
  minesCashout: () => api.post<Round>(`${BASE}/mines/cashout`, {}),
  minesActive: () => api.get<{ round: Round | null }>(`${BASE}/mines/active`),
  crashStart: (b: { bet: number; autoCashoutBps?: number; requestId: string }) => api.post<Round>(`${BASE}/crash/start`, b),
  crashCashout: () => api.post<Round>(`${BASE}/crash/cashout`, {}),
  crashState: () => api.get<{ round: Round | null }>(`${BASE}/crash/state`),
  colorPlay: (b: { bet: number; pick: string; requestId: string }) => api.post<Round>(`${BASE}/color`, b),
  colorDemo: (bet: number, pick: string) => api.post<DemoOutcome<ColorOutcome>>(`${BASE}/color/demo`, { bet, pick }),
  roulettePlay: (b: { bets: RouletteChip[]; requestId: string }) => api.post<Round>(`${BASE}/roulette`, b),
  rouletteDemo: (bets: RouletteChip[]) => api.post<DemoOutcome<RouletteOutcome>>(`${BASE}/roulette/demo`, { bets }),
  gemsPlay: (b: { bet: number; requestId: string }) => api.post<Round>(`${BASE}/gems`, b),
  gemsDemo: (bet: number) => api.post<DemoOutcome<GemsOutcome>>(`${BASE}/gems/demo`, { bet }),
  aviatorStart: (b: { bet: number; autoCashoutBps?: number; requestId: string }) => api.post<Round>(`${BASE}/aviator/start`, b),
  aviatorCashout: () => api.post<Round>(`${BASE}/aviator/cashout`, {}),
  aviatorState: () => api.get<{ round: Round | null }>(`${BASE}/aviator/state`),
  aviatorDemo: (bet: number) => api.post<{ crashBps: number }>(`${BASE}/aviator/demo`, { bet }),
  rotate: (clientSeed?: string) =>
    api.post<{ revealed: RevealedSeed; current: FairInfo }>(`${BASE}/fair/rotate`, clientSeed ? { clientSeed } : {}),
};

