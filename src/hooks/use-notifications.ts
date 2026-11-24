"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  // Notifications require a session; skip the request for signed-out visitors.
  const { data: me } = useCurrentUser();
  return useQuery<{ notifications: NotificationRow[]; unreadCount: number }>({
    queryKey: ["notifications"],
    enabled: !!me,
    queryFn: () => api.get("/api/notifications"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
