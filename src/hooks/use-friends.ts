"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import type { ChatMessage, FriendItem, PublicUser, Relation, RequestItem } from "@/server/lib/friends";

export type { ChatMessage, FriendItem, PublicUser, Relation, RequestItem };

export interface FriendsData {
  friends: FriendItem[];
  incoming: RequestItem[];
  outgoing: RequestItem[];
  counts: { unreadMessages: number; pendingRequests: number };
}

export type SearchUser = PublicUser & { relation: Relation; friendshipId: string | null };

// No websocket server in this app, so "live" = short polling. react-query pauses it in background tabs.
const LIST_POLL_MS = 6_000;
const CHAT_POLL_MS = 2_500;

export function useFriends() {
  const { data: me } = useCurrentUser();
  return useQuery<FriendsData>({
    queryKey: ["friends"],
    enabled: !!me,
    refetchInterval: LIST_POLL_MS,
    queryFn: () => api.get<FriendsData>("/api/friends"),
  });
}

/** Unread chats + incoming requests, for badges outside the Teams page. */
export function useFriendBadge() {
  const { data } = useFriends();
  return (data?.counts.unreadMessages ?? 0) + (data?.counts.pendingRequests ?? 0);
}

export function useUserSearch(query: string) {
  const q = query.trim();
  return useQuery<{ users: SearchUser[] }>({
    queryKey: ["friends", "search", q],
    enabled: q.length >= 2,
    staleTime: 10_000,
    queryFn: () => api.get(`/api/friends/search?q=${encodeURIComponent(q)}`),
  });
}

function useInvalidateFriends() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["friends"] });
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (userId: string) => api.post<{ friendshipId: string; status: "PENDING" | "ACCEPTED" }>("/api/friends/requests", { userId }),
    onSuccess: invalidate,
  });
}

export function useRespondToRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (v: { id: string; action: "accept" | "decline" }) =>
      api.post(`/api/friends/requests/${v.id}`, { action: v.action }),
    onSuccess: invalidate,
  });
}

export function useRemoveFriendship() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/friends/${id}`),
    onSuccess: invalidate,
  });
}

export function useMessages(friendshipId: string | null) {
  return useQuery<{ friend: PublicUser; messages: ChatMessage[] }>({
    queryKey: ["friends", "messages", friendshipId],
    enabled: !!friendshipId,
    refetchInterval: CHAT_POLL_MS,
    queryFn: () => api.get(`/api/friends/${friendshipId}/messages`),
  });
}

export function useSendMessage(friendshipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<ChatMessage>(`/api/friends/${friendshipId}/messages`, { body }),
    onSuccess: (msg) => {
      qc.setQueryData<{ friend: PublicUser; messages: ChatMessage[] }>(["friends", "messages", friendshipId], (old) =>
        old && !old.messages.some((m) => m.id === msg.id) ? { ...old, messages: [...old.messages, msg] } : old
      );
      qc.invalidateQueries({ queryKey: ["friends"], exact: true });
    },
  });
}
