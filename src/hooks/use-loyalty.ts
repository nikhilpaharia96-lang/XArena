"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import type { VipSummary } from "@/server/lib/loyalty";

export type { VipSummary };

export function useLoyalty() {
  const { data: me } = useCurrentUser();
  return useQuery<VipSummary>({
    queryKey: ["loyalty"],
    enabled: !!me,
    staleTime: 30_000,
    queryFn: () => api.get<VipSummary>("/api/loyalty"),
  });
}
