"use client";
import { useState } from "react";
import { useAdminDeposits } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise, formatDateTime } from "@/lib/format";
import { ArrowDownCircle } from "lucide-react";

const statusTone: Record<string, "signal" | "gold" | "crimson" | "neutral"> = {
  COMPLETED: "signal", PENDING: "gold", FAILED: "crimson", REJECTED: "crimson", REVERSED: "neutral",
};

export default function AdminDepositsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading } = useAdminDeposits(status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Deposits</h1>
      <p className="text-sm text-white/40 -mt-4">
        Deposits are verified automatically via Razorpay signature/webhook. This view is for finance visibility and reconciliation.
      </p>

      <div className="flex gap-2">
        {[undefined, "COMPLETED", "PENDING", "FAILED"].map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => setStatus(s)}
            className={`px-3.5 h-8 rounded-full text-xs font-semibold border ${status === s ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"}`}
          >
            {s ?? "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-white/5">
          {data.map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{d.username} <span className="text-white/40 font-normal">({d.email})</span></p>
                <p className="text-xs text-white/40 font-mono">{d.razorpayOrderId}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-white">{formatPaise(d.amount)}</p>
                <Badge tone={statusTone[d.status] ?? "neutral"}>{d.status}</Badge>
              </div>
              <span className="text-xs text-white/30 w-full sm:w-auto">{formatDateTime(d.createdAt)}</span>
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={ArrowDownCircle} title="No deposits found" />
      )}
    </div>
  );
}
