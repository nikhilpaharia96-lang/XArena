"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile } from "@/hooks/use-profile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, statusLabel } from "@/lib/format";
import { ChevronRight, Swords } from "lucide-react";

const statusTone: Record<string, "signal" | "gold" | "crimson" | "violet" | "neutral"> = {
  LIVE: "crimson",
  COMPLETED: "signal",
  REGISTRATION_OPEN: "gold",
  PUBLISHED: "violet",
  CANCELLED: "neutral",
};

// Matches you can still act on come first; finished ones sink to the bottom.
const rank = (status: string) => (status === "LIVE" ? 0 : status === "COMPLETED" || status === "CANCELLED" ? 2 : 1);

export default function MyMatchesPage() {
  useRequireAuth();
  const { data, isLoading } = useProfile();
  const history = [...(data?.tournamentHistory ?? [])].sort((a, b) => {
    const d = rank(a.status) - rank(b.status);
    if (d !== 0) return d;
    const ta = new Date(a.matchStartsAt).getTime();
    const tb = new Date(b.matchStartsAt).getTime();
    return rank(a.status) === 2 ? tb - ta : ta - tb;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">My Matches</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-3">
          {history.map((h) => (
            <Link key={h.id} href={`/tournaments/${h.slug}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt">
              <Card className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center shrink-0">
                  <Swords className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{h.title}</p>
                  <p className="text-xs text-white/55">{formatDateTime(h.matchStartsAt)}</p>
                  {h.teamName && <p className="text-xs text-white/40 truncate">Team: {h.teamName}</p>}
                </div>
                <Badge tone={statusTone[h.status] ?? "neutral"}>{statusLabel(h.status)}</Badge>
                <ChevronRight className="h-4 w-4 text-white/30 shrink-0" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Swords} title="No matches yet" description="Join a tournament to see your match history here."
          action={
            <Link href="/tournaments" className="inline-flex items-center justify-center h-11 px-6 rounded-xl gradient-brand text-white font-semibold text-sm">
              Browse tournaments
            </Link>
          }
        />
      )}
    </div>
  );
}
