"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";
import { useRouter } from "next/navigation";

export interface MeResponse {
  user: {
    id: string;
    uid: string;
    email: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
    status: string;
    referralCode: string;
    createdAt: string;
  };
  wallet: {
    depositBalance: number;
    winningBalance: number;
    bonusBalance: number;
    lockedBalance: number;
  };
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    kills: number;
    headshots: number;
    totalEarnings: number;
    currentStreak: number;
    bestRank: number | null;
  };
}

/** Central "am I logged in" query. Returns null (not an error) on 401 so
 * pages can render a logged-out state instead of an error boundary. */
export function useCurrentUser() {
  return useQuery<MeResponse | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/api/auth/me");
      } catch (e) {
        if (e instanceof ApiClientError && e.statusCode === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post("/api/auth/login", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; username: string; password: string; referralCode?: string }) =>
      api.post("/api/auth/signup", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.invalidateQueries();
      router.push("/login");
    },
  });
}
