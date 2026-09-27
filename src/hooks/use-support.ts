"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export function useSupportTickets() {
  return useQuery<Ticket[]>({ queryKey: ["support-tickets"], queryFn: () => api.get("/api/support-tickets") });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { subject: string; message: string; priority?: string }) =>
      api.post("/api/support-tickets", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}
