"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ProfileData {
  profile: {
    id: string; uid: string; email: string; username: string;
    displayName: string | null; avatarUrl: string | null; phone: string | null;
    emailVerified: boolean; createdAt: string;
  };
  stats: {
    matchesPlayed: number; wins: number; losses: number; kills: number;
    headshots: number; totalEarnings: number; currentStreak: number; bestRank: number | null;
  };
  tournamentHistory: {
    id: string; slug: string; title: string; bannerUrl: string | null; status: string;
    matchStartsAt: string; participantStatus: string; joinedAt: string;
  }[];
}

export function useProfile() {
  return useQuery<ProfileData>({ queryKey: ["profile"], queryFn: () => api.get("/api/profile") });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { displayName?: string; avatarUrl?: string; phone?: string }) =>
      api.patch("/api/profile", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
