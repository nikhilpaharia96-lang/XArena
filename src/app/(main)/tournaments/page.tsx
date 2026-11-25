"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Trophy } from "lucide-react";
import { useTournaments, useGames } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { FilterSheet } from "@/components/tournament/filter-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/cn";

const STATUS_TABS = [
  { key: "ALL", label: "All", apiStatus: undefined },
  { key: "LIVE", label: "Live", apiStatus: "LIVE" },
  { key: "UPCOMING", label: "Upcoming", apiStatus: "REGISTRATION_OPEN" },
  { key: "COMPLETED", label: "Completed", apiStatus: "COMPLETED" },
] as const;

const ENTRY_OPTIONS = [
  { key: "ANY", label: "Entry Fee: Any", format: undefined },
  { key: "FREE", label: "Free Entry", format: "FREE" },
  { key: "PAID", label: "Paid Entry", format: "PAID" },
] as const;

const PRIZE_SORTS = [
  { key: "NONE", label: "Prize Pool: Default" },
  { key: "HIGH", label: "Prize Pool: High to Low" },
  { key: "LOW", label: "Prize Pool: Low to High" },
] as const;

function TournamentsListing() {
  const searchParams = useSearchParams();
  const initialGame = searchParams.get("game") ?? undefined;
  const initialStatus = (searchParams.get("status") as (typeof STATUS_TABS)[number]["apiStatus"]) ?? undefined;

  const [statusKey, setStatusKey] = useState<(typeof STATUS_TABS)[number]["key"]>(
    STATUS_TABS.find((t) => t.apiStatus === initialStatus)?.key ?? "ALL"
  );
  const [gameFilter, setGameFilter] = useState<string | undefined>(initialGame);
  const [entryKey, setEntryKey] = useState<(typeof ENTRY_OPTIONS)[number]["key"]>("ANY");
  const [prizeSort, setPrizeSort] = useState<(typeof PRIZE_SORTS)[number]["key"]>("NONE");
  const [sheetOpen, setSheetOpen] = useState(false);

  const status = STATUS_TABS.find((t) => t.key === statusKey)?.apiStatus;
  const format = ENTRY_OPTIONS.find((e) => e.key === entryKey)?.format;

  const { data: games } = useGames();
  const { data: tournamentsRaw, isLoading, isError, refetch } = useTournaments({ game: gameFilter, status, format });

  const tournaments = useMemo(() => {
    if (!tournamentsRaw) return tournamentsRaw;
    const sorted = [...tournamentsRaw];
    if (prizeSort !== "NONE") {
      sorted.sort((a, b) => (prizeSort === "HIGH" ? b.prizePool - a.prizePool : a.prizePool - b.prizePool));
      return sorted;
    }
    if (statusKey !== "ALL") return tournamentsRaw;
    // Default "All" order: what you can play now comes first. Live, then
    // upcoming (soonest start first), then finished ones (most recent first).
    const rank = (status: string) => (status === "LIVE" ? 0 : status === "REGISTRATION_OPEN" ? 1 : 2);
    const start = (t: { matchStartsAt: string }) => new Date(t.matchStartsAt).getTime();
    sorted.sort((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      return ra === 2 ? start(b) - start(a) : start(a) - start(b);
    });
    return sorted;
  }, [tournamentsRaw, prizeSort, statusKey]);

  const activeGame = games?.find((g) => g.slug === gameFilter);
  const activeFilterCount = [gameFilter, entryKey !== "ANY" ? entryKey : undefined, prizeSort !== "NONE" ? prizeSort : undefined].filter(
    Boolean
  ).length;

  function clearFilters() {
    setGameFilter(undefined);
    setEntryKey("ANY");
    setPrizeSort("NONE");
  }

  const gameSelect = (
    <div>
      <label className="text-xs font-semibold text-white/50 mb-1.5 block">Game</label>
      <select
        value={gameFilter ?? ""}
        onChange={(e) => setGameFilter(e.target.value || undefined)}
        className="w-full h-11 rounded-xl bg-void border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-violet/50"
      >
        <option value="">All Games</option>
        {games?.map((g) => (
          <option key={g.id} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );

  const entrySelect = (
    <div>
      <label className="text-xs font-semibold text-white/50 mb-1.5 block">Entry Fee</label>
      <select
        value={entryKey}
        onChange={(e) => setEntryKey(e.target.value as (typeof ENTRY_OPTIONS)[number]["key"])}
        className="w-full h-11 rounded-xl bg-void border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-violet/50"
      >
        {ENTRY_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const prizeSelect = (
    <div>
      <label className="text-xs font-semibold text-white/50 mb-1.5 block">Prize Pool</label>
      <select
        value={prizeSort}
        onChange={(e) => setPrizeSort(e.target.value as (typeof PRIZE_SORTS)[number]["key"])}
        className="w-full h-11 rounded-xl bg-void border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-violet/50"
      >
        {PRIZE_SORTS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-black text-white">{activeGame ? activeGame.name : "All Tournaments"}</h1>
      </div>
      <p className="text-sm text-white/45 mb-4">{tournaments?.length ?? 0} tournaments available</p>

      {/* Status tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={statusKey === tab.key}
            onClick={() => setStatusKey(tab.key)}
            className={cn(
              "shrink-0 px-4 h-10 rounded-full text-sm font-semibold transition-colors",
              statusKey === tab.key ? "gradient-brand text-white" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters: inline row on desktop, bottom-sheet trigger on mobile */}
      <div className="hidden sm:grid grid-cols-3 gap-3 mb-5">
        {gameSelect}
        {entrySelect}
        {prizeSelect}
      </div>
      <div className="sm:hidden mb-5">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-white/70"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-violet text-[10px] font-bold flex items-center justify-center text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onClear={clearFilters}>
          {gameSelect}
          {entrySelect}
          {prizeSelect}
        </FilterSheet>
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
        <EmptyState
          icon={Trophy}
          title="No tournaments match your filters"
          description="Try a different game, entry fee or status."
          action={
            activeFilterCount > 0 || statusKey !== "ALL" ? (
              <button
                onClick={() => {
                  clearFilters();
                  setStatusKey("ALL");
                }}
                className="text-sm font-semibold text-violet"
              >
                Clear Filters
              </button>
            ) : undefined
          }
        />
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
