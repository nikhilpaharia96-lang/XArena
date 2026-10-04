"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Game {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  supportedModes: string[];
}

export interface TournamentListItem {
  thumbnailUrl?: string | null;
  id: string;
  slug: string;
  title: string;
  bannerUrl: string | null;
  gameId: string;
  gameName: string;
  gameSlug: string;
  gameIcon: string | null;
  mode: string;
  format: "FREE" | "PAID";
  cadence: string;
  status: string;
  entryFee: number;
  prizePool: number;
  maxSlots: number;
  slotsFilled: number;
  slotsLeft: number;
  roomSize: number;
  map: string | null;
  category: string | null;
  registrationStartsAt: string;
  registrationEndsAt: string;
  matchStartsAt: string;
  isFeatured: boolean;
  isJoined: boolean;
}

export interface TournamentDetail extends Omit<TournamentListItem, "isFeatured"> {
  description: string;
  prizeDistribution: { position: number; amount: number }[];
  rules: string;
  scoringSystem: string | null;
  roomId: string | null;
  roomPassword: string | null;
  roomReleasedAt: string | null;
  participants: { id: string; teamName: string | null; status: string; joinedAt: string; username: string; avatarUrl: string | null }[];
  currentUserId: string | null;
}

export function useGames() {
  return useQuery<Game[]>({
    queryKey: ["games"],
    queryFn: () => api.get<Game[]>("/api/games"),
    staleTime: 5 * 60_000,
  });
}

export function useTournaments(
  filters?: { game?: string; status?: string; format?: string; featured?: boolean; category?: string },
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (filters?.game) params.set("game", filters.game);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.format) params.set("format", filters.format);
  if (filters?.featured) params.set("featured", "1");
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();

  return useQuery<TournamentListItem[]>({
    queryKey: ["tournaments", filters],
    queryFn: () => api.get<TournamentListItem[]>(`/api/tournaments${qs ? `?${qs}` : ""}`),
    staleTime: 15_000,
    enabled: options?.enabled ?? true,
  });
}

export function useTournamentDetail(slug: string) {
  return useQuery<TournamentDetail>({
    queryKey: ["tournament", slug],
    queryFn: () => api.get<TournamentDetail>(`/api/tournaments/${slug}`),
    enabled: Boolean(slug),
    staleTime: 10_000,
  });
}

export function useJoinTournament(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamName?: string) => api.post(`/api/tournaments/${slug}/join`, { teamName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournament", slug] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useSubmitResult(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { placement?: number; kills: number; screenshotUrl: string }) =>
      api.post(`/api/tournaments/${slug}/result`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournament", slug] }),
  });
}

export interface GameCategorySummary {
  game: { id: string; slug: string; name: string };
  totals: { activeCount: number; prizePool: number; players: number };
  categories: { value: string; activeCount: number; prizePool: number; players: number; upcomingCount: number }[];
}

export function useGameCategories(gameSlug: string) {
  return useQuery<GameCategorySummary>({
    queryKey: ["game-categories", gameSlug],
    queryFn: () => api.get<GameCategorySummary>(`/api/games/${gameSlug}/categories`),
    staleTime: 30_000,
  });
}
