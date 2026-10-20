"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ProviderStatus {
  provider: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "NOT_TESTED";
  config: {
    apiBaseUrl: string;
    apiKeyConfigured: boolean;
    secretConfigured: boolean;
    publicAppUrl: string | null;
    callbackUrl: string | null;
    publicUrlIsHttps: boolean;
  };
  catalogue: {
    total: number;
    enabled: number;
    available: number;
    inrAvailable: boolean;
    lastSync: { at: string; ok: boolean; total: number; created: number; updated: number; markedUnavailable: number; skipped: number; error?: string } | null;
  };
  lastRequest: { ok: number; httpStatus: number | null; errorKind: string | null; providerRequestId: string | null; createdAt: string } | null;
  lastCallback: { outcome: string; createdAt: string } | null;
  failedRequests24h: number;
  problemCallbacks24h: number;
  notes: string[];
}

export interface AdminProviderGame {
  id: string;
  providerGameId: string;
  title: string;
  providerName: string;
  category: string;
  imageUrl: string | null;
  currencies: string[];
  isEnabled: boolean;
  isAvailable: boolean;
  lastSyncedAt: string;
}

interface Paged { pagination: { page: number; total: number; totalPages: number } }

export interface ConnectionTest {
  ok: boolean;
  durationMs: number;
  requestId: string | null;
  currencyCount: number;
  inrSupported: boolean;
  error?: string;
  errorKind?: string;
}

const key = (...k: unknown[]) => ["admin", "astech", ...k];

export const useAsTechStatus = () => useQuery<ProviderStatus>({ queryKey: key("status"), queryFn: () => api.get("/api/admin/providers/astech") });

export function useAsTechGames(p: { page: number; search: string; category: string; provider: string; enabled: string }) {
  const q = new URLSearchParams({ page: String(p.page) });
  if (p.search) q.set("search", p.search);
  if (p.category) q.set("category", p.category);
  if (p.provider) q.set("provider", p.provider);
  if (p.enabled) q.set("enabled", p.enabled);
  return useQuery<{ games: AdminProviderGame[]; facets: { categories: string[]; providers: string[] } } & Paged>({
    queryKey: key("games", p),
    queryFn: () => api.get(`/api/admin/providers/astech/games?${q}`),
    placeholderData: (prev) => prev,
  });
}

export const useAsTechTransactions = (page: number, status: string) =>
  useQuery<{ transactions: Record<string, string | number | null>[] } & Paged>({
    queryKey: key("transactions", page, status),
    queryFn: () => api.get(`/api/admin/providers/astech/transactions?page=${page}${status ? `&status=${status}` : ""}`),
  });

export const useAsTechLogs = (type: "callbacks" | "requests", page: number, failedOnly: boolean) =>
  useQuery<{ logs: Record<string, string | number | null>[] } & Paged>({
    queryKey: key("logs", type, page, failedOnly),
    queryFn: () => api.get(`/api/admin/providers/astech/logs?type=${type}&page=${page}${failedOnly ? "&failedOnly=1" : ""}`),
  });

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConnectionTest>("/api/admin/providers/astech/test"),
    onSettled: () => qc.invalidateQueries({ queryKey: key("status") }),
  });
}

export function useSyncGames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/admin/providers/astech/sync"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "astech"] }),
  });
}

export function useToggleGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => api.patch(`/api/admin/providers/astech/games/${id}`, { isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "astech"] }),
  });
}
