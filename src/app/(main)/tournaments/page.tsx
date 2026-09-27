"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTournaments, useGames } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/cn";
import { Trophy } from "lucide-react";

const FORMAT_TABS = [
  { key: undefined, label: "All" },
  { key: "FREE", label: "Free" },
  { key: "PAID", label: "Paid" },
] as const;

function TournamentsListing() {
  const searchParams = useSearchParams();
  const gameFilter = searchParams.get("game") ?? undefined;
  const [format, setFormat] = useState<string | undefined>(undefined);

  const { data: games } = useGames();
  const { data: tournaments, isLoading, isError, refetch } = useTournaments({ game: gameFilter, format });

  const activeGame = games?.find((g) => g.slug === gameFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-black text-white">{activeGame ? activeGame.name : "All Tournaments"}</h1>
      </div>
      <p className="text-sm text-white/45 mb-4">{tournaments?.length ?? 0} tournaments available</p>

      <div className="flex gap-2 mb-5">
        {FORMAT_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setFormat(tab.key)}
            className={cn(
              "px-4 h-9 rounded-full text-sm font-semibold transition-colors",
              format === tab.key ? "gradient-brand text-white" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No tournaments match your filters" description="Try a different game or format." />
      )}
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense>
      <TournamentsListing />
    </Suspense>
  );
}
