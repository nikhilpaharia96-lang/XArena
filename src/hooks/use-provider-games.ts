"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ProviderGame {
  id: string;
  title: string;
  provider: string;
  category: string;
  imageUrl: string | null;
}

export interface ProviderGamesResponse {
  categories: string[];
  games: ProviderGame[];
}

export interface LaunchResponse {
  gameUrl: string;
  embeddable: boolean;
  singleUse: boolean;
  expiresIn: number | null;
  mode: string | null;
  category: string | null;
}

export function useProviderGames(category?: string) {
  return useQuery<ProviderGamesResponse>({
    queryKey: ["provider-games", category ?? "all"],
    queryFn: () => api.get(`/api/provider-games${category ? `?category=${encodeURIComponent(category)}` : ""}`),
    staleTime: 5 * 60_000,
  });
}

/** Always a fresh request: the launch URL is single-use and must never be reused or cached. */
export function launchProviderGame(id: string) {
  return api.post<LaunchResponse>(`/api/provider-games/${encodeURIComponent(id)}/launch`, {});
}
