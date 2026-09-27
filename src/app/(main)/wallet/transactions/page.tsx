"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTransactions } from "@/hooks/use-wallet";
import { TransactionItem } from "@/components/wallet/transaction-item";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ArrowLeft, Receipt } from "lucide-react";

const TYPE_FILTERS = [
  { key: undefined, label: "All" },
  { key: "DEPOSIT", label: "Deposits" },
  { key: "WITHDRAWAL", label: "Withdrawals" },
  { key: "TOURNAMENT_ENTRY", label: "Entries" },
  { key: "TOURNAMENT_PRIZE", label: "Prizes" },
  { key: "REFERRAL_BONUS", label: "Referrals" },
] as const;

export default function TransactionsPage() {
  useRequireAuth();
  const [type, setType] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTransactions({ type, page });

  return (
    <div className="space-y-4">
      <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>
      <h1 className="text-xl font-black text-white">Transaction History</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => {
              setType(f.key);
              setPage(1);
            }}
            className={cn(
              "px-3.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
              type === f.key ? "gradient-brand text-white" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="p-4 divide-y divide-white/5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 my-1" />)
        ) : data && data.transactions.length > 0 ? (
          data.transactions.map((t) => <TransactionItem key={t.id} txn={t} />)
        ) : (
          <EmptyState icon={Receipt} title="No transactions found" />
        )}
      </Card>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-white/40">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
