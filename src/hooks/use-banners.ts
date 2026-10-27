"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaUrl: string | null;
}

/** Live hero slides managed from Admin > Hero Banners. */
export function useBanners() {
  return useQuery<HeroBanner[]>({
    queryKey: ["banners"],
    queryFn: () => api.get("/api/banners"),
    staleTime: 60_000,
  });
}
