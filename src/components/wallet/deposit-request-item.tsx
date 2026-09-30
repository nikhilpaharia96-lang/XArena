"use client";
import { Clock, CheckCircle2, XCircle, QrCode } from "lucide-react";
import { formatPaiseExact, formatDateTime } from "@/lib/format";
import type { DepositRequestItem } from "@/hooks/use-wallet";
import { Badge } from "@/components/ui/badge";

const meta = {
  PENDING: { icon: Clock, tone: "gold", label: "Pending Verification", box: "bg-gold/10", text: "text-gold" },
  APPROVED: { icon: CheckCircle2, tone: "signal", label: "Approved", box: "bg-signal/10", text: "text-signal" },
  REJECTED: { icon: XCircle, tone: "crimson", label: "Rejected", box: "bg-crimson/10", text: "text-crimson" },
} as const;

export function DepositRequestRow({ deposit }: { deposit: DepositRequestItem }) {
  const m = meta[deposit.status];
  const Icon = m.icon;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${m.box}`}>
        <Icon className={`h-4 w-4 ${m.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5 text-white/40 shrink-0" /> UPI Deposit
        </p>
        <p className="text-xs text-white/40 font-mono truncate">
          {deposit.status === "PENDING" ? `UTR: ${deposit.utr} • ` : ""}
          {formatDateTime(deposit.createdAt)}
        </p>
        {deposit.status === "REJECTED" && deposit.adminNote && (
          <p className="text-xs text-crimson/90 mt-1 break-words">Reason: {deposit.adminNote}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold font-mono text-white">{formatPaiseExact(deposit.amount)}</p>
        <Badge tone={m.tone} className="mt-0.5 whitespace-nowrap">{m.label}</Badge>
      </div>
    </div>
  );
}
