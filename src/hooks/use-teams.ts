"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import type { TeamDetail, TeamInviteItem, TeamSummary } from "@/server/lib/teams";

export type { TeamDetail, TeamInviteItem, TeamSummary };

export function useTeams() {
  const { data: me } = useCurrentUser();
  return useQuery<{ teams: TeamSummary[]; invites: TeamInviteItem[] }>({
    queryKey: ["teams"],
    enabled: !!me,
    refetchInterval: 15_000,
    queryFn: () => api.get("/api/teams"),
  });
}

export function useTeamDetail(id: string | null) {
  return useQuery<TeamDetail>({
    queryKey: ["teams", "detail", id],
    enabled: !!id,
    refetchInterval: 10_000,
    queryFn: () => api.get(`/api/teams/${id}`),
  });
}

function useInvalidateTeams() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["friends"] });
  };
}

export function useCreateTeam() {
  const inv = useInvalidateTeams();
  return useMutation({
    mutationFn: (b: { name: string; tag: string; gameId: string; ign?: string; gameUid?: string }) =>
      api.post<{ id: string }>("/api/teams", b),
    onSuccess: inv,
  });
}

export function useUpdateTeam(id: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (b: { name?: string; tag?: string }) => api.patch(`/api/teams/${id}`, b), onSuccess: inv });
}

export function useDisbandTeam(id: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: () => api.delete(`/api/teams/${id}`), onSuccess: inv });
}

export function useInviteToTeam(id: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (userId: string) => api.post(`/api/teams/${id}/invites`, { userId }), onSuccess: inv });
}

export function useRespondToTeamInvite() {
  const inv = useInvalidateTeams();
  return useMutation({
    mutationFn: (v: { id: string; action: "accept" | "decline" }) => api.post<{ accepted: boolean; teamId?: string }>(`/api/teams/invites/${v.id}`, { action: v.action }),
    onSuccess: inv,
  });
}

export function useCancelTeamInvite() {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (inviteId: string) => api.delete(`/api/teams/invites/${inviteId}`), onSuccess: inv });
}

export function useRemoveTeamMember(teamId: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (userId: string) => api.delete(`/api/teams/${teamId}/members/${userId}`), onSuccess: inv });
}

export function useTransferCaptain(teamId: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (userId: string) => api.post(`/api/teams/${teamId}/captain`, { userId }), onSuccess: inv });
}

export function useUpdateMyTeamDetails(teamId: string) {
  const inv = useInvalidateTeams();
  return useMutation({ mutationFn: (b: { ign: string; gameUid: string }) => api.put(`/api/teams/${teamId}/me`, b), onSuccess: inv });
}
