"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface WalletSummary {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
  lockedBalance: number;
  totalBalance: number;
  pendingWithdrawals: number;
}

export interface TransactionRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  balanceAfter: number;
  referenceId: string;
  description: string | null;
  createdAt: string;
}

export function useWallet() {
  return useQuery<WalletSummary>({
    queryKey: ["wallet"],
    queryFn: () => api.get<WalletSummary>("/api/wallet"),
    staleTime: 10_000,
  });
}

export function useTransactions(filters?: { type?: string; status?: string; page?: number }) {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.page) params.set("page", String(filters.page));
  const qs = params.toString();

  return useQuery<{ transactions: TransactionRow[]; pagination: { page: number; totalPages: number; total: number } }>({
    queryKey: ["transactions", filters],
    queryFn: () => api.get(`/api/wallet/transactions${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateDepositOrder() {
  return useMutation({
    mutationFn: (amountRupees: number) =>
      api.post<{ orderId: string; amount: number; currency: string; keyId?: string }>("/api/wallet/deposit", {
        amountRupees,
      }),
  });
}

export function useVerifyDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
      api.post("/api/wallet/deposit/verify", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRequestWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountRupees: number; upiId: string }) => api.post("/api/wallet/withdraw", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Manual UPI deposits (QR + UTR + screenshot → admin verification)
// ---------------------------------------------------------------------------

export interface PaymentInfo {
  upiId: string;
  accountName: string;
  instructions: string;
  minDepositRupees: number;
  maxDepositRupees: number;
  depositEnabled: boolean;
  configured: boolean;
  hasQr: boolean;
}

export interface DepositRequestItem {
  id: string;
  code: string | null;
  amount: number;
  utr: string;
  paymentMethod: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export function usePaymentInfo() {
  return useQuery<PaymentInfo>({
    queryKey: ["payment-info"],
    queryFn: () => api.get<PaymentInfo>("/api/payment-settings"),
    staleTime: 30_000,
  });
}

export function useMyDeposits() {
  return useQuery<DepositRequestItem[]>({
    queryKey: ["my-deposits"],
    queryFn: () => api.get<DepositRequestItem[]>("/api/wallet/deposits"),
    // Keep polling while something is awaiting admin review so approval shows up without a manual refresh.
    refetchInterval: (query) => (query.state.data?.some((d) => d.status === "PENDING") ? 15_000 : false),
  });
}

export function useSubmitDepositRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountRupees: number; utr: string; screenshot: File }) => {
      const form = new FormData();
      form.set("amountRupees", String(input.amountRupees));
      form.set("utr", input.utr);
      form.set("screenshot", input.screenshot);
      return api.postForm<{ id: string; code: string; status: string }>("/api/wallet/deposits", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
