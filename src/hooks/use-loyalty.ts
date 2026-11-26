"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import type { LoyaltySummary } from "@/server/lib/loyalty";

export type { LoyaltySummary };

export function useLoyalty() {
  const { data: me } = useCurrentUser();
  return useQuery<LoyaltySummary>({
    queryKey: ["loyalty"],
    enabled: !!me,
    staleTime: 30_000,
    queryFn: () => api.get<LoyaltySummary>("/api/loyalty"),
  });
}
