"use client";
import { ArrowDownLeft, ArrowUpRight, Trophy, Gift, Undo2, Settings2 } from "lucide-react";
import { formatPaise, formatDateTime } from "@/lib/format";
import type { TransactionRow } from "@/hooks/use-wallet";
import { Badge } from "@/components/ui/badge";

const typeMeta: Record<string, { icon: typeof ArrowDownLeft; label: string; credit: boolean }> = {
  DEPOSIT: { icon: ArrowDownLeft, label: "Deposit", credit: true },
  WITHDRAWAL: { icon: ArrowUpRight, label: "Withdrawal", credit: false },
  TOURNAMENT_ENTRY: { icon: ArrowUpRight, label: "Entry Fee", credit: false },
  TOURNAMENT_PRIZE: { icon: Trophy, label: "Prize Won", credit: true },
  REFERRAL_BONUS: { icon: Gift, label: "Referral Bonus", credit: true },
  BONUS_CREDIT: { icon: Gift, label: "Bonus", credit: true },
  REFUND: { icon: Undo2, label: "Refund", credit: true },
  ADMIN_ADJUSTMENT: { icon: Settings2, label: "Adjustment", credit: true },
};

const statusTone: Record<string, "signal" | "gold" | "crimson" | "neutral"> = {
  COMPLETED: "signal",
  PENDING: "gold",
  FAILED: "crimson",
  REJECTED: "crimson",
  REVERSED: "neutral",
};

export function TransactionItem({ txn }: { txn: TransactionRow }) {
  const meta = typeMeta[txn.type] ?? { icon: Settings2, label: txn.type, credit: true };
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta.credit ? "bg-signal/10" : "bg-crimson/10"}`}>
        <Icon className={`h-4 w-4 ${meta.credit ? "text-signal" : "text-crimson"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{meta.label}</p>
        <p className="text-xs text-white/40 font-mono truncate">{txn.referenceId} • {formatDateTime(txn.createdAt)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold font-mono ${meta.credit ? "text-signal" : "text-white"}`}>
          {meta.credit ? "+" : "-"}{formatPaise(txn.amount)}
        </p>
        <Badge tone={statusTone[txn.status] ?? "neutral"} className="mt-0.5">{txn.status}</Badge>
      </div>
    </div>
  );
}
