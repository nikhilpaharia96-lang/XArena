"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalInvites: number;
  totalEarned: number;
  invites: { id: string; username: string; avatarUrl: string | null; bonusAmount: number; bonusPaidAt: string | null; createdAt: string }[];
}

export function useReferral() {
  return useQuery<ReferralData>({
    queryKey: ["referral"],
    queryFn: () => api.get<ReferralData>("/api/referral"),
  });
}
