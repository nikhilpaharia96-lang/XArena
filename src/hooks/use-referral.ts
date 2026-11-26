"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";

export interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalInvites: number;
  totalEarned: number;
  qualified: number;
  pending: number;
  milestones: { count: number; rewardPaise: number; reached: boolean; paid: boolean }[];
  config: { referrerRewardPaise: number; friendRewardPaise: number; minDepositPaise: number };
  invites: { id: string; username: string; avatarUrl: string | null; bonusAmount: number; bonusPaidAt: string | null; createdAt: string }[];
}

export function useReferral() {
  const { data: me } = useCurrentUser();
  return useQuery<ReferralData>({
    queryKey: ["referral"],
    enabled: !!me,
    queryFn: () => api.get<ReferralData>("/api/referral"),
  });
}
