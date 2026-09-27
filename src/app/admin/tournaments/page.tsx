"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminTournaments, useTournamentAction } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise, formatDateTime, statusLabel } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Plus, Trophy, Copy, Ban, Send } from "lucide-react";

const statusTone: Record<string, "signal" | "gold" | "crimson" | "violet" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "violet",
  REGISTRATION_OPEN: "gold",
  REGISTRATION_CLOSED: "gold",
  LIVE: "crimson",
  COMPLETED: "signal",
  CANCELLED: "neutral",
};

function TournamentRowActions({ id, status }: { id: string; status: string }) {
  const publish = useTournamentAction(id, "publish");
  const clone = useTournamentAction(id, "clone");
  const cancel = useTournamentAction(id, "cancel");

  return (
    <div className="flex gap-1.5">
      {status === "DRAFT" && (
        <Button size="sm" variant="secondary" onClick={() => publish.mutate(undefined, { onSuccess: () => toast({ title: "Published", tone: "success" }) })} loading={publish.isPending}>
          <Send className="h-3.5 w-3.5" /> Publish
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => clone.mutate(undefined, { onSuccess: () => toast({ title: "Cloned as draft", tone: "success" }) })} loading={clone.isPending}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {!["COMPLETED", "CANCELLED"].includes(status) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const reason = prompt("Reason for cancelling (refunds all participants):");
            if (reason) cancel.mutate({ reason }, { onSuccess: () => toast({ title: "Tournament cancelled", tone: "success" }) });
          }}
          loading={cancel.isPending}
        >
          <Ban className="h-3.5 w-3.5 text-crimson" />
        </Button>
      )}
    </div>
  );
}

export default function AdminTournamentsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading } = useAdminTournaments(status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Tournaments</h1>
        <Link href="/admin/tournaments/new">
          <Button>
            <Plus className="h-4 w-4" /> New Tournament
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[undefined, "DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "LIVE", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            key={s ?? "all"}
            onClick={() => setStatus(s)}
            className={`px-3.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap border ${
              status === s ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"
            }`}
          >
            {s ? statusLabel(s) : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((t) => (
            <Card key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link href={`/admin/tournaments/${t.id}`} className="font-bold text-white text-sm hover:text-violet">
                    {t.title}
                  </Link>
                  <Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel(t.status)}</Badge>
                </div>
                <p className="text-xs text-white/40">
                  {t.gameName} · {formatPaise(t.entryFee)} entry · {formatPaise(t.prizePool)} pool · {t.slotsFilled}/{t.maxSlots} joined · {formatDateTime(t.matchStartsAt)}
                </p>
              </div>
              <TournamentRowActions id={t.id} status={t.status} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No tournaments found" />
      )}
    </div>
  );
}
