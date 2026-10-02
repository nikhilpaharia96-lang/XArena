"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface AdminAnalytics {
  kpis: {
    totalUsers: number; activeUsers: number; totalTournaments: number; liveTournaments: number;
    totalDeposits: number; totalWithdrawals: number; totalEntryFees: number; totalPrizesAwarded: number;
    revenue: number; pendingWithdrawals: number; pendingResults: number; openTickets: number;
  };
  signupSeries: { day: string; count: number }[];
  depositSeries: { day: string; total: number }[];
  recentActivity: { id: string; action: string; targetType: string | null; targetId: string | null; createdAt: string; actorUsername: string | null }[];
}

export interface AdminTournamentRow {
  id: string; slug: string; title: string; status: string; format: string; mode: string;
  entryFee: number; prizePool: number; maxSlots: number; slotsFilled: number;
  matchStartsAt: string; registrationEndsAt: string; createdAt: string; gameName: string;
  isFeatured?: number | boolean; category?: string | null;
}

export interface AdminUserRow {
  id: string; uid: string; email: string; username: string; role: string; status: string;
  createdAt: string; lastLoginAt: string | null; depositBalance: number; winningBalance: number; bonusBalance: number;
}

export interface AdminDepositRow {
  id: string; amount: number; status: string; razorpayOrderId: string; razorpayPaymentId: string | null;
  createdAt: string; verifiedAt: string | null; userId: string; username: string; email: string;
}

export interface AdminWithdrawalRow {
  id: string; amount: number; status: string; upiId: string | null; createdAt: string;
  userId: string; username: string; email: string;
}

export interface AdminResultRow {
  id: string; placement: number | null; kills: number; screenshotUrl: string | null; submittedAt: string;
  isDisputed: boolean; disputeReason: string | null; verifiedAt: string | null;
  username: string; tournamentTitle: string; tournamentSlug: string;
}

export interface AdminBannerRow {
  id: string; title: string; imageUrl: string; linkUrl: string | null; sortOrder: number; isActive: boolean; createdAt: string;
}

export interface AdminAuditLogRow {
  id: string; action: string; targetType: string | null; targetId: string | null; metadata: string | null;
  ipAddress: string | null; createdAt: string; actorUsername: string | null; actorEmail: string | null;
}

export interface AdminTicketRow {
  id: string; subject: string; message: string; status: string; priority: string; createdAt: string;
  userId: string; username: string; email: string;
}

export function useAdminAnalytics() {
  return useQuery<AdminAnalytics>({ queryKey: ["admin", "analytics"], queryFn: () => api.get("/api/admin/analytics") });
}

export function useAdminTournaments(status?: string) {
  return useQuery<AdminTournamentRow[]>({
    queryKey: ["admin", "tournaments", status],
    queryFn: () => api.get(`/api/admin/tournaments?limit=200${status ? `&status=${status}` : ""}`),
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/tournaments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tournaments"] }),
  });
}

export function useToggleFeatured() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      api.patch(`/api/admin/tournaments/${id}`, { isFeatured }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tournaments"] }),
  });
}

export function useAdminTournamentDetail(id: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ["admin", "tournament", id],
    queryFn: () => api.get(`/api/admin/tournaments/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => api.post("/api/admin/tournaments", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tournaments"] }),
  });
}

export function useUpdateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => api.patch(`/api/admin/tournaments/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
      qc.invalidateQueries({ queryKey: ["admin", "tournament", id] });
    },
  });
}

export function useTournamentAction(id: string, action: "publish" | "cancel" | "clone" | "room") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: unknown) => api.post(`/api/admin/tournaments/${id}/${action}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
      qc.invalidateQueries({ queryKey: ["admin", "tournament", id] });
    },
  });
}

export function useAdminUsers(search?: string, page = 1) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  return useQuery<{ users: AdminUserRow[]; pagination: { page: number; totalPages: number; total: number } }>({
    queryKey: ["admin", "users", search, page],
    queryFn: () => api.get(`/api/admin/users?${params}`),
  });
}

export function useUserAction(userId: string, action: "ban" | "suspend" | "reactivate" | "reset-password" | "wallet-adjust") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: unknown) => api.post(`/api/admin/users/${userId}/${action}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminDeposits(status?: string) {
  return useQuery<AdminDepositRow[]>({
    queryKey: ["admin", "deposits", status],
    queryFn: () => api.get(`/api/admin/deposits${status ? `?status=${status}` : ""}`),
  });
}

export function useAdminWithdrawals(status = "PENDING") {
  return useQuery<AdminWithdrawalRow[]>({
    queryKey: ["admin", "withdrawals", status],
    queryFn: () => api.get(`/api/admin/withdrawals?status=${status}`),
  });
}

export function useWithdrawalAction(id: string, action: "approve" | "reject") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: unknown) => api.post(`/api/admin/withdrawals/${id}/${action}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] }),
  });
}

export function useAdminResults(filter: "pending" | "disputed" | "verified" = "pending") {
  return useQuery<AdminResultRow[]>({
    queryKey: ["admin", "results", filter],
    queryFn: () => api.get(`/api/admin/results?filter=${filter}`),
  });
}

export function useResultAction(id: string, action: "verify" | "dispute") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: unknown) => api.post(`/api/admin/results/${id}/${action}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "results"] }),
  });
}

export function useAdminBanners() {
  return useQuery<AdminBannerRow[]>({ queryKey: ["admin", "banners"], queryFn: () => api.get("/api/admin/banners") });
}

export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => api.post("/api/admin/banners", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "banners"] }),
  });
}

export function useBroadcastNotification() {
  return useMutation({
    mutationFn: (input: { title: string; body: string; target: string }) => api.post("/api/admin/notifications/broadcast", input),
  });
}

export function useAdminAuditLogs(page = 1) {
  return useQuery<{ logs: AdminAuditLogRow[]; pagination: { page: number; totalPages: number; total: number } }>({
    queryKey: ["admin", "audit-logs", page],
    queryFn: () => api.get(`/api/admin/audit-logs?page=${page}`),
  });
}

export function useAdminSupportTickets(status?: string) {
  return useQuery<AdminTicketRow[]>({
    queryKey: ["admin", "support-tickets", status],
    queryFn: () => api.get(`/api/admin/support-tickets${status ? `?status=${status}` : ""}`),
  });
}

export function useUpdateTicket(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => api.patch(`/api/admin/support-tickets/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "support-tickets"] }),
  });
}

// ---------------------------------------------------------------------------
// Manual UPI deposit requests + payment settings
// ---------------------------------------------------------------------------

export interface AdminDepositRequestRow {
  id: string; code: string | null; userId: string; username: string; email: string;
  amount: number; utr: string; paymentMethod: string; status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null; reviewedById: string | null; reviewedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface AdminPaymentSettings {
  upiId: string; accountName: string; instructions: string;
  minDepositRupees: number; maxDepositRupees: number; depositEnabled: boolean; hasQr: boolean;
}

export function useAdminDepositRequests(status: "PENDING" | "APPROVED" | "REJECTED") {
  return useQuery<{ requests: AdminDepositRequestRow[]; counts: Record<string, number> }>({
    queryKey: ["admin", "deposit-requests", status],
    queryFn: () => api.get(`/api/admin/deposit-requests?status=${status}`),
    refetchInterval: status === "PENDING" ? 20_000 : false,
  });
}

export function useDepositRequestAction(id: string, action: "approve" | "reject") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: { reason?: string }) => api.post(`/api/admin/deposit-requests/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "deposit-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "analytics"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminPaymentSettings() {
  return useQuery<AdminPaymentSettings>({
    queryKey: ["admin", "payment-settings"],
    queryFn: () => api.get("/api/admin/payment-settings"),
  });
}

export function useSavePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.putForm<AdminPaymentSettings>("/api/admin/payment-settings", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "payment-settings"] });
      qc.invalidateQueries({ queryKey: ["payment-info"] });
    },
  });
}
