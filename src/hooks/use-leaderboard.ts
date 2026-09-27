"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface LeaderboardRow {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  totalWinnings?: number;
  prizesWon?: number;
  matchesPlayed?: number;
  wins?: number;
  kills?: number;
  winRate?: number;
  referralCount?: number;
  totalEarned?: number;
}

export function useLeaderboard(type: "winners" | "players" | "referrers", period: "daily" | "weekly" | "monthly" | "all") {
  return useQuery<LeaderboardRow[]>({
    queryKey: ["leaderboard", type, period],
    queryFn: () => api.get<LeaderboardRow[]>(`/api/leaderboard?type=${type}&period=${period}`),
    staleTime: 30_000,
  });
}
