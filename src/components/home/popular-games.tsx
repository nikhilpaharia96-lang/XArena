"use client";

import { useMemo } from "react";
import { Gamepad2 } from "lucide-react";
import { useGames, useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { GameCard } from "./game-card";
import { SectionHeader } from "./section-header";

export function PopularGames() {
  const { data: games, isLoading } = useGames();
  // Same unfiltered query StatsStrip already fetches, so this is a free
  // cache hit (react-query dedupes by key) rather than an extra request.
  const { data: tournaments } = useTournaments();

  const countsByGame = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tournaments ?? []) {
      map.set(t.gameId, (map.get(t.gameId) ?? 0) + 1);
    }
    return map;
  }, [tournaments]);

  return (
    <section>
      <SectionHeader title="Popular Games" href="/games" />
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-[84px] shrink-0 rounded-2xl" />)
        ) : games && games.length > 0 ? (
          games.map((g) => <GameCard key={g.id} game={g} tournamentCount={countsByGame.get(g.id) ?? 0} />)
        ) : (
          <div className="w-full">
            <EmptyState icon={Gamepad2} title="No games yet" description="Games will show up here once they're added." className="py-8" />
          </div>
        )}
      </div>
    </section>
  );
}
