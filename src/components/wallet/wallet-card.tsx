"use client";
import { motion } from "framer-motion";
import { formatPaise } from "@/lib/format";
import { Wallet as WalletIcon, TrendingUp, Gift, Lock } from "lucide-react";

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
    { label: "Deposit", value: depositBalance, icon: WalletIcon, tone: "text-cobalt" },
    { label: "Winnings", value: winningBalance, icon: TrendingUp, tone: "text-signal" },
    { label: "Bonus", value: bonusBalance, icon: Gift, tone: "text-gold" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl glow-border p-6 gradient-brand"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Total Balance</p>
      <p className="text-white text-3xl sm:text-4xl font-black font-mono mt-1 tracking-tight truncate">{formatPaise(total)}</p>

      <div className="grid grid-cols-3 gap-2 mt-5">
        {rows.map((r) => (
          <div key={r.label} className="bg-black/20 rounded-2xl p-2.5 sm:p-3 backdrop-blur-sm min-w-0">
            <r.icon className={`h-4 w-4 mb-1.5 ${r.tone}`} />
            <p className="text-[9px] sm:text-[10px] text-white/60 uppercase tracking-wide truncate">{r.label}</p>
            <p className="text-xs sm:text-sm font-bold text-white font-mono truncate">{formatPaise(r.value)}</p>
          </div>
        ))}
      </div>

      {lockedBalance > 0 && (
        <div className="flex items-center gap-1.5 mt-3 text-white/60 text-xs">
          <Lock className="h-3 w-3" /> {formatPaise(lockedBalance)} locked in pending withdrawals
        </div>
      )}
    </motion.div>
  );
}
