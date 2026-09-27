"use client";
import { useState } from "react";
import { useAdminWithdrawals, useWithdrawalAction } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ArrowUpCircle, Check, X } from "lucide-react";

function WithdrawalRow({ w }: { w: { id: string; amount: number; status: string; upiId: string | null; createdAt: string; username: string; email: string } }) {
  const approve = useWithdrawalAction(w.id, "approve");
  const reject = useWithdrawalAction(w.id, "reject");

  return (
    <div className="p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-sm font-semibold text-white">{w.username} <span className="text-white/40 font-normal">({w.email})</span></p>
        <p className="text-xs text-white/40">UPI: {w.upiId} · {formatDateTime(w.createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-gold">{formatPaise(w.amount)}</span>
        {w.status === "PENDING" ? (
          <>
            <Button size="sm" variant="secondary" loading={approve.isPending} onClick={() => approve.mutate(undefined, { onSuccess: () => toast({ title: "Approved", tone: "success" }) })}>
              <Check className="h-3.5 w-3.5 text-signal" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={reject.isPending}
              onClick={() => {
                const reason = prompt("Reason for rejection:");
                if (reason) reject.mutate({ reason }, { onSuccess: () => toast({ title: "Rejected, funds returned", tone: "success" }) });
              }}
            >
              <X className="h-3.5 w-3.5 text-crimson" />
            </Button>
          </>
        ) : (
          <Badge tone={w.status === "APPROVED" ? "signal" : "crimson"}>{w.status}</Badge>
        )}
      </div>
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState("PENDING");
  const { data, isLoading } = useAdminWithdrawals(status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Withdrawals</h1>
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3.5 h-8 rounded-full text-xs font-semibold border ${status === s ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"}`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-white/5">{data.map((w) => <WithdrawalRow key={w.id} w={w} />)}</Card>
      ) : (
        <EmptyState icon={ArrowUpCircle} title={`No ${status.toLowerCase()} withdrawals`} />
      )}
    </div>
  );
}
