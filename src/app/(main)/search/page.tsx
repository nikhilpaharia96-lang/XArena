"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, Trophy, Gamepad2, X } from "lucide-react";
import { useGames, useTournaments } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { GameCard } from "@/components/home/game-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Global search across tournaments and games, wired to real data
 * (useTournaments / useGames — the same endpoints the rest of the app
 * uses). Filtering is done client-side because /api/tournaments has no
 * text-search parameter yet.
 *
 * Scope note: the brief also asked for searching "teams" and "players".
 * This app has no public team directory and no player-search endpoint
 * (only a leaderboard of top performers), so that part isn't wired up —
 * adding it would need a new API route rather than a UI change.
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const { data: tournaments, isLoading: tLoading } = useTournaments();
  const { data: games, isLoading: gLoading } = useGames();

  const matchedTournaments = useMemo(() => {
    if (!q || !tournaments) return [];
    return tournaments.filter((t) => t.title.toLowerCase().includes(q) || t.gameName.toLowerCase().includes(q));
  }, [q, tournaments]);

  const matchedGames = useMemo(() => {
    if (!q || !games) return [];
    return games.filter((g) => g.name.toLowerCase().includes(q) || g.shortName?.toLowerCase().includes(q));
  }, [q, games]);

  const loading = tLoading || gLoading;
  const hasResults = matchedTournaments.length > 0 || matchedGames.length > 0;

  return (
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tournaments or games…"
          className="w-full h-12 rounded-2xl bg-surface border border-white/10 pl-11 pr-10 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-violet/50"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>
        )}
      </div>

      {!q ? (
        <p className="text-sm text-white/45 text-center py-10">Start typing to search tournaments and games.</p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !hasResults ? (
        <EmptyState icon={SearchIcon} title={`No results for "${query}"`} description="Try a different tournament or game name." />
      ) : (
        <div className="space-y-6">
          {matchedGames.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-1.5">
                <Gamepad2 className="h-4 w-4" /> Games
              </h2>
              <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                {matchedGames.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            </section>
          )}
          {matchedTournaments.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-white/70 mb-3 flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Tournaments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matchedTournaments.map((t) => (
                  <TournamentCard key={t.id} tournament={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-white/30">
        Looking for a player or team?{" "}
        <Link href="/leaderboard" className="text-violet font-semibold">
          Check the leaderboard
        </Link>
      </p>
    </div>
  );
}
