"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatPaiseExact as formatPaise } from "@/lib/format";
import { ArrowDownToLine, Plus, Wallet as WalletIcon, TrendingUp, Gift, Lock } from "lucide-react";

export function WalletCard({
  depositBalance,
  winningBalance,
  bonusBalance,
  lockedBalance,
}: {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
  lockedBalance: number;
}) {
  const total = depositBalance + winningBalance + bonusBalance;

  const rows = [
    { label: "Deposit", hint: "Play with it", value: depositBalance, icon: WalletIcon, tone: "text-cobalt", bar: "bg-cobalt" },
    { label: "Winnings", hint: "Withdrawable", value: winningBalance, icon: TrendingUp, tone: "text-signal", bar: "bg-signal" },
    { label: "Bonus", hint: "Play to unlock", value: bonusBalance, icon: Gift, tone: "text-gold", bar: "bg-gold" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="force-dark relative overflow-hidden rounded-[28px] p-5 sm:p-6 border border-cobalt/40 bg-surface shadow-[0_24px_50px_-26px_rgba(37,99,235,0.7)]"
    >
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#1D4ED8_0%,#1E3A8A_55%,#1B2559_100%)]" />
      <div aria-hidden className="absolute -top-16 -right-12 h-48 w-48 rounded-full bg-gold/25 blur-[70px]" />
      <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />

      <p className="relative text-white/80 text-xs font-semibold uppercase tracking-wider">Total balance</p>
      <p className="relative text-white text-[40px] leading-none font-black font-mono mt-2 tracking-tight tabular-nums truncate">{formatPaise(total)}</p>

      {/* How the balance splits, at a glance */}
      <div className="relative mt-4 flex h-2 overflow-hidden rounded-full bg-white/15" role="img" aria-label="Balance split between deposit, winnings and bonus">
        {total > 0 && rows.map((r) => (r.value > 0 ? <span key={r.label} className={r.bar} style={{ width: `${(r.value / total) * 100}%` }} /> : null))}
      </div>

      <div className="relative grid grid-cols-3 gap-2 mt-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-[#13265F]/90 border border-[#2A3F86] rounded-2xl p-2.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${r.bar}`} />
              <p className="text-[11px] text-white/70 uppercase tracking-wide truncate">{r.label}</p>
            </div>
            <p className="mt-1 text-sm font-bold text-white font-mono tabular-nums truncate">{formatPaise(r.value)}</p>
            <p className="text-[11px] text-white/50 truncate">{r.hint}</p>
          </div>
        ))}
      </div>

      {lockedBalance > 0 && (
        <div className="relative flex items-center gap-1.5 mt-3 text-white/70 text-xs">
          <Lock className="h-3 w-3" /> {formatPaise(lockedBalance)} locked in pending withdrawals
        </div>
      )}

      <div className="relative grid grid-cols-2 gap-2.5 mt-4">
        <Link href="/wallet/deposit" className="flex h-12 items-center justify-center gap-2 rounded-2xl gradient-cta text-sm font-black text-white shadow-[0_10px_24px_-10px_rgba(249,115,22,0.8)] active:scale-[0.98] transition-transform">
          <Plus className="h-4 w-4" strokeWidth={3} /> Add Money
        </Link>
        <Link href="/wallet/withdraw" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/12 border border-white/20 text-sm font-black text-white active:bg-white/20 transition-colors">
          <ArrowDownToLine className="h-4 w-4" /> Withdraw
        </Link>
      </div>
    </motion.div>
  );
}
