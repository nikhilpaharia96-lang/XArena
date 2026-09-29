"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Gamepad2, Trophy, Users } from "lucide-react";
import { useGameCategories, useTournaments } from "@/hooks/use-tournaments";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { CategoryCard } from "@/components/games/category-card";
import { CATEGORY_VISUALS } from "@/components/games/category-visuals";
import { FreeFireHeader } from "@/components/games/free-fire-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCompactNumber, formatPaise } from "@/lib/format";
import {
  FREE_FIRE_CATEGORIES,
  FREE_FIRE_GAME_SLUG,
  POPULAR_CATEGORY_VALUES,
  categoryHref,
  findCategoryByValue,
} from "@/lib/free-fire-categories";

function TournamentSection({ title, status, icon: Icon, emptyText }: { title: string; status: string; icon: typeof Flame; emptyText: string }) {
  const { data, isLoading } = useTournaments({ game: FREE_FIRE_GAME_SLUG, status });
  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold text-white mb-3">
        <Icon className="h-4 w-4 text-gold" /> {title}
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} title={emptyText} className="py-8" />
      )}
    </section>
  );
}

export default function FreeFirePage() {
  const { data: summary, isLoading } = useGameCategories(FREE_FIRE_GAME_SLUG);
  const stats = summary?.totals;
  const counts = new Map(summary?.categories.map((c) => [c.value, c]));

  return (
    <div className="space-y-7">
      <FreeFireHeader title="Free Fire" backHref="/games" />

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-3xl overflow-hidden border border-white/8 p-5"
        style={{ background: "linear-gradient(135deg, #7C2D12 0%, #1E1B4B 60%, #020617 100%)" }}
      >
        <h2 className="font-display font-black text-3xl italic text-white leading-none">FREE FIRE</h2>
        <p className="font-display font-extrabold text-lg italic text-gold mt-1">TOURNAMENT ARENA</p>
        <p className="text-sm text-white/75 mt-3 max-w-xs">Choose your mode and find your next match.</p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { icon: Gamepad2, value: stats ? String(stats.activeCount) : null, label: "Active Tournaments", tone: "text-cobalt" },
            { icon: Users, value: stats ? formatCompactNumber(stats.players) : null, label: "Players Joined", tone: "text-cobalt" },
            { icon: Trophy, value: stats ? formatPaise(stats.prizePool) : null, label: "Prize Pool", tone: "text-gold" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-black/30 border border-white/10 p-2.5">
              <s.icon className={`h-4 w-4 ${s.tone}`} />
              {isLoading ? <Skeleton className="h-5 w-12 mt-1.5" /> : <p className="text-sm font-bold text-white mt-1 truncate">{s.value ?? "—"}</p>}
              <p className="text-[10px] text-white/50 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Popular categories */}
      <section>
        <h2 className="flex items-center gap-2 text-base font-bold text-white mb-3">
          <Flame className="h-4 w-4 text-gold" /> Popular Categories
        </h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {POPULAR_CATEGORY_VALUES.map((v) => {
            const cat = findCategoryByValue(v)!;
            const Icon = CATEGORY_VISUALS[v].icon;
            return (
              <Link
                key={v}
                href={categoryHref(v)}
                className="shrink-0 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-surface border border-white/10 text-sm font-semibold text-white"
              >
                <Icon className="h-4 w-4 text-gold" /> {cat.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Category grid */}
      <section>
        <h2 className="text-base font-bold text-white mb-3">All Categories</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)
            : FREE_FIRE_CATEGORIES.map((c) => (
                <CategoryCard
                  key={c.value}
                  value={c.value}
                  activeCount={counts.get(c.value)?.activeCount ?? 0}
                  prizePool={counts.get(c.value)?.prizePool ?? 0}
                />
              ))}
        </div>
      </section>

      <TournamentSection title="Live Free Fire Tournaments" status="LIVE" icon={Flame} emptyText="No live Free Fire tournaments right now" />
      <TournamentSection title="Upcoming Free Fire Tournaments" status="REGISTRATION_OPEN" icon={Trophy} emptyText="No upcoming Free Fire tournaments yet" />
    </div>
  );
}
