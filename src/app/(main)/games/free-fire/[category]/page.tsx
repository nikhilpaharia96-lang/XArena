"use client";

import { useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Trophy } from "lucide-react";
import { useGameCategories, useTournaments } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { FilterSheet } from "@/components/tournament/filter-sheet";
import { FreeFireHeader } from "@/components/games/free-fire-header";
import { CATEGORY_VISUALS } from "@/components/games/category-visuals";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/cn";
import { formatCompactNumber, formatPaise, gameModeLabel } from "@/lib/format";
import { FREE_FIRE_CATEGORIES, FREE_FIRE_GAME_SLUG, FREE_FIRE_ROUTE, findCategoryBySlug } from "@/lib/free-fire-categories";

const STATUS_TABS = [
  { key: "ALL", label: "All", apiStatus: undefined },
  { key: "LIVE", label: "Live", apiStatus: "LIVE" },
  { key: "UPCOMING", label: "Upcoming", apiStatus: "REGISTRATION_OPEN" },
  { key: "COMPLETED", label: "Completed", apiStatus: "COMPLETED" },
] as const;

const DAY = 24 * 60 * 60 * 1000;
const selectCls = "w-full h-11 rounded-xl bg-void border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-violet/50";

export default function FreeFireCategoryPage() {
  const { category: slug } = useParams<{ category: string }>();
  const cat = findCategoryBySlug(slug);
  if (!cat) notFound();
  return <CategoryView cat={cat} />;
}

function CategoryView({ cat }: { cat: NonNullable<ReturnType<typeof findCategoryBySlug>> }) {
  const router = useRouter();

  const [statusKey, setStatusKey] = useState<(typeof STATUS_TABS)[number]["key"]>("ALL");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [entry, setEntry] = useState<"ANY" | "FREE" | "PAID">("ANY");
  const [prizeSort, setPrizeSort] = useState<"NONE" | "HIGH" | "LOW">("NONE");
  const [mode, setMode] = useState("");
  const [map, setMap] = useState("");
  const [date, setDate] = useState<"ANY" | "TODAY" | "WEEK">("ANY");
  const [sheetOpen, setSheetOpen] = useState(false);
  // Reference time for the Date filter, captured once per mount (keeps render pure).
  const [now] = useState(() => Date.now());

  const status = STATUS_TABS.find((t) => t.key === statusKey)?.apiStatus;
  const { data: raw, isLoading, isError, refetch } = useTournaments({
    game: FREE_FIRE_GAME_SLUG,
    category: cat.value,
    status,
    format: entry === "ANY" ? undefined : entry,
  });
  const { data: summary } = useGameCategories(FREE_FIRE_GAME_SLUG);
  const stats = summary?.categories.find((c) => c.value === cat.value);
  const { icon: Icon, gradient } = CATEGORY_VISUALS[cat.value];

  // Options derived from real tournament data.
  const modes = useMemo(() => Array.from(new Set(raw?.map((t) => t.mode) ?? [])), [raw]);
  const maps = useMemo(() => Array.from(new Set((raw?.map((t) => t.map).filter(Boolean) as string[]) ?? [])), [raw]);

  const tournaments = useMemo(() => {
    if (!raw) return raw;
    const q = query.trim().toLowerCase();
    const list = raw.filter((t) => {
      if (mode && t.mode !== mode) return false;
      if (map && t.map !== map) return false;
      if (date !== "ANY") {
        const diff = new Date(t.matchStartsAt).getTime() - now;
        if (diff < 0 || diff > (date === "TODAY" ? DAY : 7 * DAY)) return false;
      }
      if (q && !`${t.title} ${t.map ?? ""} ${cat.label}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (prizeSort !== "NONE") list.sort((a, b) => (prizeSort === "HIGH" ? b.prizePool - a.prizePool : a.prizePool - b.prizePool));
    return list;
  }, [raw, query, mode, map, date, prizeSort, cat.label, now]);

  const activeFilterCount = [entry !== "ANY", prizeSort !== "NONE", mode, map, date !== "ANY"].filter(Boolean).length;

  function reset() {
    setEntry("ANY");
    setPrizeSort("NONE");
    setMode("");
    setMap("");
    setDate("ANY");
  }

  const controls = (
    <>
      <Field label="Category">
        <select value={cat.slug} onChange={(e) => router.push(`${FREE_FIRE_ROUTE}/${e.target.value}`)} className={selectCls}>
          {FREE_FIRE_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{c.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Entry Fee">
        <select value={entry} onChange={(e) => setEntry(e.target.value as typeof entry)} className={selectCls}>
          <option value="ANY">Any</option>
          <option value="FREE">Free Entry</option>
          <option value="PAID">Paid Entry</option>
        </select>
      </Field>
      <Field label="Prize Pool">
        <select value={prizeSort} onChange={(e) => setPrizeSort(e.target.value as typeof prizeSort)} className={selectCls}>
          <option value="NONE">Default</option>
          <option value="HIGH">High to Low</option>
          <option value="LOW">Low to High</option>
        </select>
      </Field>
      <Field label="Team Size">
        <select value={mode} onChange={(e) => setMode(e.target.value)} className={selectCls}>
          <option value="">Any</option>
          {modes.map((m) => (
            <option key={m} value={m}>{gameModeLabel(m)}</option>
          ))}
        </select>
      </Field>
      <Field label="Map">
        <select value={map} onChange={(e) => setMap(e.target.value)} className={selectCls}>
          <option value="">Any</option>
          {maps.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <select value={date} onChange={(e) => setDate(e.target.value as typeof date)} className={selectCls}>
          <option value="ANY">Any</option>
          <option value="TODAY">Next 24 hours</option>
          <option value="WEEK">Next 7 days</option>
        </select>
      </Field>
    </>
  );

  return (
    <div>
      <FreeFireHeader
        title={cat.label.toUpperCase()}
        backHref={FREE_FIRE_ROUTE}
        onSearch={() => setShowSearch((s) => !s)}
        onFilter={() => setSheetOpen(true)}
      />

      {/* Category hero */}
      <section className={`rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br ${gradient} p-5 relative mb-4`}>
        <Icon className="absolute right-4 top-4 h-20 w-20 text-white/15" />
        <h2 className="relative font-display font-black italic text-3xl text-white leading-none">{cat.label.toUpperCase()}</h2>
        <p className="relative text-sm text-white/80 mt-2">{cat.tagline}</p>
        <div className="relative grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Active", value: String(stats?.activeCount ?? 0) },
            { label: "Players Joined", value: formatCompactNumber(stats?.players ?? 0) },
            { label: "Prize Pool", value: formatPaise(stats?.prizePool ?? 0) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-black/35 border border-white/10 p-2.5">
              <p className="text-sm font-bold text-white truncate">{s.value}</p>
              <p className="text-[10px] text-white/55">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {showSearch && (
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Free Fire tournaments..."
            className="w-full h-12 rounded-2xl bg-surface border border-white/10 pl-11 pr-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-violet/50"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusKey(tab.key)}
            className={cn(
              "shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition-colors",
              statusKey === tab.key ? "gradient-brand text-white" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters: inline on desktop, bottom sheet on mobile */}
      <div className="hidden sm:grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">{controls}</div>
      <div className="sm:hidden mb-5">
        <button
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-white/70"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          {activeFilterCount > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-violet text-[10px] font-bold flex items-center justify-center text-white">{activeFilterCount}</span>
          )}
        </button>
      </div>
      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onClear={reset}>
        {controls}
      </FilterSheet>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
          title={`No ${cat.label} tournaments found`}
          description="Try a different tab or clear your filters. New tournaments are added regularly."
          action={
            activeFilterCount > 0 || query || statusKey !== "ALL" ? (
              <button
                onClick={() => {
                  reset();
                  setQuery("");
                  setStatusKey("ALL");
                }}
                className="text-sm font-semibold text-violet"
              >
                Reset filters
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/50 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
