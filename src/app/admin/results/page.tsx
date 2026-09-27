"use client";
import { useState } from "react";
import { useAdminResults, useResultAction } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { ShieldCheck, Check, Flag, ExternalLink } from "lucide-react";

function ResultRow({ r }: { r: { id: string; placement: number | null; kills: number; screenshotUrl: string | null; submittedAt: string; username: string; tournamentTitle: string } }) {
  const verify = useResultAction(r.id, "verify");
  const dispute = useResultAction(r.id, "dispute");

  return (
    <div className="p-4 flex items-center justify-between flex-wrap gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{r.username} — {r.tournamentTitle}</p>
        <p className="text-xs text-white/40">
          Placement #{r.placement ?? "—"} · {r.kills} kills · {formatDateTime(r.submittedAt)}
        </p>
        {r.screenshotUrl && (
          <a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cobalt flex items-center gap-1 mt-1">
            View proof <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={verify.isPending}
          onClick={() =>
            verify.mutate(undefined, {
              onSuccess: (data) => {
                const d = data as { prizeAwarded: number };
                toast({ title: "Result verified", description: d.prizeAwarded > 0 ? `₹${d.prizeAwarded / 100} prize awarded` : "No prize for this placement", tone: "success" });
              },
              onError: (err) => toast({ title: "Failed", description: err instanceof ApiClientError ? err.message : "", tone: "error" }),
            })
          }
        >
          <Check className="h-3.5 w-3.5" /> Verify
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={dispute.isPending}
          onClick={() => {
            const reason = prompt("Reason for dispute:");
            if (reason) dispute.mutate({ reason }, { onSuccess: () => toast({ title: "Marked as disputed", tone: "success" }) });
          }}
        >
          <Flag className="h-3.5 w-3.5 text-crimson" />
        </Button>
      </div>
    </div>
  );
}

export default function AdminResultsPage() {
  const [filter, setFilter] = useState<"pending" | "disputed" | "verified">("pending");
  const { data, isLoading } = useAdminResults(filter);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Result Verification</h1>
      <div className="flex gap-2">
        {(["pending", "disputed", "verified"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3.5 h-8 rounded-full text-xs font-semibold capitalize border ${filter === f ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-white/5">{data.map((r) => <ResultRow key={r.id} r={r} />)}</Card>
      ) : (
        <EmptyState icon={ShieldCheck} title={`No ${filter} results`} />
      )}
    </div>
  );
}
