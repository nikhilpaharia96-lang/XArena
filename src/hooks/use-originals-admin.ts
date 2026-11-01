"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GameKey } from "@/hooks/use-originals";

export interface AdminGameConfig {
  gameKey: GameKey;
  isEnabled: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  maxPayout: number;
  updatedAt: string;
}

export interface GameStat {
  gameKey: GameKey;
  rounds: number;
  wagered: number;
  paidOut: number;
  ggr: number;
  openRounds: number;
  openStake: number;
}

export interface AdminRound {
  id: string;
  userId: string;
  username: string;
  gameKey: GameKey;
  status: string;
  betAmount: number;
  payoutAmount: number;
  multiplierBps: number;
  createdAt: string;
  settledAt: string | null;
}

export interface OriginalsOverview {
  configs: AdminGameConfig[];
  statsAllTime: GameStat[];
  stats24h: GameStat[];
  recent: AdminRound[];
}

export function useOriginalsOverview() {
  return useQuery<OriginalsOverview>({ queryKey: ["admin-originals"], queryFn: () => api.get("/api/admin/originals"), refetchInterval: 15_000 });
}

export function useUpdateOriginalConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, patch }: { game: GameKey; patch: Partial<Pick<AdminGameConfig, "isEnabled" | "houseEdgeBps" | "minBet" | "maxBet" | "maxPayout">> }) =>
      api.patch<AdminGameConfig>(`/api/admin/originals/${game}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-originals"] }),
  });
}

export function useVoidRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/originals/rounds/${encodeURIComponent(id)}/void`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-originals"] }),
  });
}
