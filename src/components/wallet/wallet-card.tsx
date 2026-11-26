"use client";
import { motion } from "framer-motion";
import { formatPaiseExact as formatPaise } from "@/lib/format";
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
      className="force-dark relative overflow-hidden rounded-3xl p-6 border border-cobalt/35 bg-surface shadow-[0_16px_36px_-24px_rgba(0,0,0,0.9)]"
    >
      {/* brand glows + faint grid for a premium, layered surface */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(135deg,#1D4ED8_0%,#1E3A8A_55%,#1B2559_100%)]" />
      <p className="relative text-white/75 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
        <WalletIcon className="h-3.5 w-3.5 text-gold" /> Total Balance
      </p>
      <p className="relative text-white text-4xl font-black font-mono mt-1.5 tracking-tight truncate ">{formatPaise(total)}</p>

      <div className="relative grid grid-cols-3 gap-2 mt-5">
        {rows.map((r) => (
          <div key={r.label} className="bg-[#13265F] border border-[#2A3F86] rounded-2xl p-2.5 sm:p-3 min-w-0">
            <r.icon className={`h-4 w-4 mb-1.5 ${r.tone}`} />
            <p className="text-[11px] text-white/60 uppercase tracking-wide truncate">{r.label}</p>
            <p className="text-sm font-bold text-white font-mono truncate">{formatPaise(r.value)}</p>
          </div>
        ))}
      </div>

      {lockedBalance > 0 && (
        <div className="relative flex items-center gap-1.5 mt-3 text-white/60 text-xs">
          <Lock className="h-3 w-3" /> {formatPaise(lockedBalance)} locked in pending withdrawals
        </div>
      )}
    </motion.div>
  );
}
