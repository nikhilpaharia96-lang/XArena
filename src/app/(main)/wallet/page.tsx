"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, useTransactions } from "@/hooks/use-wallet";
import { WalletCard } from "@/components/wallet/wallet-card";
import { TransactionItem } from "@/components/wallet/transaction-item";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, History, Receipt } from "lucide-react";

export default function WalletPage() {
  const { data: me } = useRequireAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txnData, isLoading: txnLoading } = useTransactions({ page: 1 });

  if (me === undefined || walletLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-white">My Wallet</h1>

      {wallet && (
        <WalletCard
          depositBalance={wallet.depositBalance}
          winningBalance={wallet.winningBalance}
          bonusBalance={wallet.bonusBalance}
          lockedBalance={wallet.lockedBalance}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/wallet/deposit">
          <Card className="p-4 flex items-center gap-3 hover:glow-border transition-shadow">
            <div className="h-10 w-10 rounded-xl bg-signal/15 flex items-center justify-center">
              <ArrowDownCircle className="h-5 w-5 text-signal" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Deposit</p>
              <p className="text-[11px] text-white/40">Add money</p>
            </div>
          </Card>
        </Link>
        <Link href="/wallet/withdraw">
          <Card className="p-4 flex items-center gap-3 hover:glow-border transition-shadow">
            <div className="h-10 w-10 rounded-xl bg-gold/15 flex items-center justify-center">
              <ArrowUpCircle className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Withdraw</p>
              <p className="text-[11px] text-white/40">Cash out winnings</p>
            </div>
          </Card>
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-white text-sm flex items-center gap-1.5">
            <History className="h-4 w-4 text-white/40" /> Recent Activity
          </h2>
          <Link href="/wallet/transactions" className="text-xs text-violet font-semibold">
            View all
          </Link>
        </div>
        <Card className="p-4 divide-y divide-white/5">
          {txnLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 my-1" />)
          ) : txnData && txnData.transactions.length > 0 ? (
            txnData.transactions.slice(0, 5).map((t) => <TransactionItem key={t.id} txn={t} />)
          ) : (
            <EmptyState icon={Receipt} title="No transactions yet" description="Your deposits, entries, and winnings will show up here." />
          )}
        </Card>
      </div>
    </div>
  );
}
