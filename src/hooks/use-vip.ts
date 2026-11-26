"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import type { VipSummary } from "@/server/lib/vip";

export type { VipSummary };

export function useVip() {
  const { data: me } = useCurrentUser();
  return useQuery<VipSummary>({
    queryKey: ["vip"],
    enabled: !!me,
    staleTime: 30_000,
    queryFn: () => api.get<VipSummary>("/api/vip"),
  });
}
