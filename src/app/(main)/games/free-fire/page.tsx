"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import { useGameCategories, useTournaments } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { CategoryCard } from "@/components/games/category-card";
import { FreeFireHeader } from "@/components/games/free-fire-header";
import { FreeFireHero } from "@/components/games/free-fire-hero";
import { PopularCategoryChips } from "@/components/games/popular-category-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FREE_FIRE_CATEGORIES, FREE_FIRE_GAME_SLUG } from "@/lib/free-fire-categories";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "HIGH", label: "High Prize" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "DEFAULT", label: "Default order" },
  { key: "PRIZE", label: "Highest prize" },
  { key: "ACTIVE", label: "Most active" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const chip =
  "h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt";

export default function FreeFirePage() {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [sort, setSort] = useState<SortKey>("DEFAULT");
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: summary, isLoading, isError, refetch } = useGameCategories(FREE_FIRE_GAME_SLUG);
  const q = query.trim().toLowerCase();
  // Only fetched once the player starts searching (used to match tournament titles).
  const { data: allTournaments } = useTournaments({ game: FREE_FIRE_GAME_SLUG }, { enabled: q.length > 0 });

  const stats = useMemo(() => new Map(summary?.categories.map((c) => [c.value, c])), [summary]);

  const matchingTournaments = useMemo(
    () => (q ? (allTournaments ?? []).filter((t) => `${t.title} ${t.map ?? ""}`.toLowerCase().includes(q)) : []),
    [allTournaments, q]
  );

  const categories = useMemo(() => {
    const tournamentCats = new Set(matchingTournaments.map((t) => t.category));
    const list = FREE_FIRE_CATEGORIES.filter((c) => {
      const s = stats.get(c.value);
      if (q && !`${c.label} ${c.description} ${c.slug}`.toLowerCase().includes(q) && !tournamentCats.has(c.value)) return false;
      if (filter === "ACTIVE") return (s?.activeCount ?? 0) > 0;
      if (filter === "UPCOMING") return (s?.upcomingCount ?? 0) > 0;
      if (filter === "HIGH") return (s?.prizePool ?? 0) > 0;
      return true;
    });
    const by = (key: "prizePool" | "activeCount") => (a: (typeof list)[number], b: (typeof list)[number]) =>
      (stats.get(b.value)?.[key] ?? 0) - (stats.get(a.value)?.[key] ?? 0);
    if (filter === "HIGH" || sort === "PRIZE") return [...list].sort(by("prizePool"));
    if (sort === "ACTIVE") return [...list].sort(by("activeCount"));
    return list;
  }, [q, filter, sort, stats, matchingTournaments]);

  const reset = () => {
    setQuery("");
    setFilter("ALL");
    setSort("DEFAULT");
  };
  const filtersActive = q.length > 0 || filter !== "ALL" || sort !== "DEFAULT";

  const viewAll = () => {
    reset();
    listRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FreeFireHeader title="Free Fire" backHref="/games" />

      <FreeFireHero stats={summary?.totals} isLoading={isLoading} />

      <PopularCategoryChips onViewAll={viewAll} />

      <section ref={listRef} aria-labelledby="all-cats-title" className="scroll-mt-20 space-y-3">
        <h2 id="all-cats-title" className="text-lg font-bold text-white">
          All Categories <span className="ml-1 font-semibold text-[#94A3B8]">· {categories.length}</span>
        </h2>

        {/* Search + filter toggle */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tournaments…"
              aria-label="Search tournaments"
              className="h-12 w-full rounded-2xl border border-white/10 bg-elevated pl-10 pr-10 text-sm text-white placeholder:text-[#94A3B8] focus:border-cobalt/70 focus:outline-none focus:ring-2 focus:ring-cobalt/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#94A3B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
            aria-controls="ff-sort-panel"
            aria-label="Sort options"
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-elevated transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
              panelOpen || sort !== "DEFAULT" ? "border-cobalt/70 text-cobalt" : "border-white/10 text-white"
            )}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
            {sort !== "DEFAULT" && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold" />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {panelOpen && (
            <motion.div
              id="ff-sort-panel"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div role="radiogroup" aria-label="Sort categories" className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-elevated p-3">
                <span className="mr-1 text-xs font-semibold text-[#94A3B8]">Sort by</span>
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    role="radio"
                    aria-checked={sort === s.key}
                    onClick={() => setSort(s.key)}
                    className={cn(chip, "h-9 px-3 text-xs", sort === s.key ? "border-cobalt bg-cobalt/20 text-white" : "border-white/10 text-white/70")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter chips */}
        <div role="tablist" aria-label="Filter categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5">
          {FILTERS.map((f) => (
            <motion.button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              whileTap={reduce ? undefined : { scale: 0.95 }}
              onClick={() => setFilter(f.key)}
              className={cn(
                chip,
                "min-w-[64px]",
                filter === f.key
                  ? "border-cobalt bg-gradient-to-b from-[#2F6BFF] to-[#1D4ED8] text-white shadow-[0_0_16px_-4px_rgba(37,99,255,0.9)]"
                  : "border-white/10 bg-elevated text-white/75 hover:border-cobalt/40"
              )}
            >
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* Grid */}
        {isError ? (
          <ErrorState message="Couldn't load categories." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[286px] rounded-[20px]" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={filter === "ACTIVE" && !q ? "No active tournaments right now." : "No tournaments available"}
            description={q ? `Nothing matches “${query.trim()}”.` : "Try another filter or check back soon."}
            className="py-10"
            action={
              filter === "ACTIVE" && !q && (summary?.categories.some((c) => c.upcomingCount > 0) ?? false) ? (
                <Button onClick={() => setFilter("UPCOMING")}>View Upcoming</Button>
              ) : (
                filtersActive && <Button variant="outline" onClick={reset}>Reset filters</Button>
              )
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <AnimatePresence mode="popLayout" initial>
              {categories.map((c, i) => (
                <CategoryCard
                  key={c.value}
                  value={c.value}
                  index={i}
                  activeCount={stats.get(c.value)?.activeCount ?? 0}
                  prizePool={stats.get(c.value)?.prizePool ?? 0}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {q && matchingTournaments.length > 0 && (
        <section aria-labelledby="matching-title" className="space-y-3">
          <h2 id="matching-title" className="text-base font-bold text-white">
            Matching tournaments <span className="ml-1 font-semibold text-[#94A3B8]">· {matchingTournaments.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchingTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
