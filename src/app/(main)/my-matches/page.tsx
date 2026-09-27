"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile } from "@/hooks/use-profile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, statusLabel } from "@/lib/format";
import { Swords } from "lucide-react";

const statusTone: Record<string, "signal" | "gold" | "crimson" | "violet" | "neutral"> = {
  LIVE: "crimson",
  COMPLETED: "signal",
  REGISTRATION_OPEN: "gold",
  PUBLISHED: "violet",
  CANCELLED: "neutral",
};

export default function MyMatchesPage() {
  useRequireAuth();
  const { data, isLoading } = useProfile();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">My Matches</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data && data.tournamentHistory.length > 0 ? (
        <div className="space-y-3">
          {data.tournamentHistory.map((h) => (
            <Link key={h.id} href={`/tournaments/${h.slug}`}>
              <Card className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center shrink-0">
                  <Swords className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{h.title}</p>
                  <p className="text-xs text-white/40">{formatDateTime(h.matchStartsAt)}</p>
                </div>
                <Badge tone={statusTone[h.status] ?? "neutral"}>{statusLabel(h.status)}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Swords} title="No matches yet" description="Join a tournament to see your match history here." />
      )}
    </div>
  );
}
