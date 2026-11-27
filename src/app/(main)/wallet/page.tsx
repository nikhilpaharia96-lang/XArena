"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, useTransactions, useMyDeposits, useBonuses, type TransactionRow } from "@/hooks/use-wallet";
import { BonusProgress } from "@/components/wallet/bonus-offers";
import { formatPaiseExact } from "@/lib/format";
import { DepositRequestRow } from "@/components/wallet/deposit-request-item";
import { WalletCard } from "@/components/wallet/wallet-card";
import { TransactionItem } from "@/components/wallet/transaction-item";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { ChevronRight, Clock, Crown, Gift, History, Hourglass, Receipt, type LucideIcon } from "lucide-react";

const QUICK: { href: string; label: string; sub: string; icon: LucideIcon }[] = [
  { href: "/wallet/transactions", label: "History", sub: "All transactions", icon: Receipt },
  { href: "/rewards", label: "Rewards", sub: "Level & rebates", icon: Crown },
  { href: "/referral", label: "Refer", sub: "Earn bonus", icon: Gift },
];

/** "Today" / "Yesterday" / "24 Nov" — computed from the calendar date in the viewer's timezone. */
function dayLabel(iso: string, todayKey: string): string {
  const d = new Date(iso);
  const key = d.toDateString();
  if (key === todayKey) return "Today";
  const y = new Date(todayKey);
  y.setDate(y.getDate() - 1);
  if (key === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function groupByDay(txns: TransactionRow[], todayKey: string) {
  const groups: { label: string; items: TransactionRow[] }[] = [];
  for (const t of txns) {
    const label = dayLabel(t.createdAt, todayKey);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }
  return groups;
}

export default function WalletPage() {
  const { data: me } = useRequireAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txnData, isLoading: txnLoading } = useTransactions({ page: 1 });
  const { data: deposits } = useMyDeposits();
  const { data: bonuses } = useBonuses();
  const qc = useQueryClient();
  const [todayKey] = useState(() => new Date().toDateString());

  // When a pending deposit gets reviewed by an admin, pull the fresh (server-authoritative) balance + ledger.
  const pendingCount = deposits?.filter((d) => d.status === "PENDING").length ?? 0;
  const prevPending = useRef(pendingCount);
  useEffect(() => {
    if (pendingCount < prevPending.current) {
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    }
    prevPending.current = pendingCount;
  }, [pendingCount, qc]);

  if (me === undefined || walletLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (!me) return null;

  const pending = deposits?.filter((d) => d.status === "PENDING") ?? [];
  const pendingTotal = pending.reduce((n, d) => n + d.amount, 0);
  const groups = txnData ? groupByDay(txnData.transactions.slice(0, 8), todayKey) : [];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white">My Wallet</h1>

      {wallet && (
        <WalletCard
          depositBalance={wallet.depositBalance}
          winningBalance={wallet.winningBalance}
          bonusBalance={wallet.bonusBalance}
          lockedBalance={wallet.lockedBalance}
        />
      )}

      {pending.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-3.5">
          <span className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center shrink-0"><Hourglass className="h-5 w-5 text-gold" /></span>
          <p className="text-sm text-white/85">
            <span className="font-bold text-white">{formatPaiseExact(pendingTotal)}</span> deposit {pending.length > 1 ? `(${pending.length} requests) ` : ""}is being verified. It will be added as soon as an admin approves it.
          </p>
        </div>
      )}

      {bonuses && <BonusProgress grants={bonuses.grants} />}

      <div className="grid grid-cols-3 gap-2.5">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="rounded-2xl bg-surface border border-white/10 p-3 active:bg-white/[0.06] transition-colors">
            <q.icon className="h-5 w-5 text-cobalt" />
            <p className="mt-2 text-sm font-bold text-white">{q.label}</p>
            <p className="text-[11px] text-white/55 truncate">{q.sub}</p>
          </Link>
        ))}
      </div>

      {deposits && deposits.length > 0 && (
        <div>
          <h2 className="font-bold text-white text-sm flex items-center gap-1.5 mb-2">
            <Clock className="h-4 w-4 text-white/50" /> Deposit Requests
            {pending.length > 0 && <span className="text-[11px] font-semibold text-gold">· {pending.length} pending</span>}
          </h2>
          <Card className="p-4 divide-y divide-white/5">
            {deposits.slice(0, 5).map((d) => (
              <DepositRequestRow key={d.id} deposit={d} />
            ))}
          </Card>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-white text-sm flex items-center gap-1.5">
            <History className="h-4 w-4 text-white/50" /> Recent Activity
          </h2>
          <Link href="/wallet/transactions" className="inline-flex items-center gap-0.5 h-11 pl-3 -mr-2 pr-2 text-xs text-cobalt font-bold">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {txnLoading ? (
          <Card className="p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 my-1" />)}</Card>
        ) : groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50">{g.label}</p>
                <Card className="px-4 py-1 divide-y divide-white/5">
                  {g.items.map((t) => <TransactionItem key={t.id} txn={t} />)}
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <EmptyState icon={Receipt} title="No transactions yet" description="Your deposits, entries, and winnings will show up here." />
          </Card>
        )}
      </div>
    </div>
  );
}
