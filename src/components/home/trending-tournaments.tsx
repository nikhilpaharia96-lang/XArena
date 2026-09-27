"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatPaise } from "@/lib/format";
import { SectionHeader } from "./section-header";
import type { TournamentListItem } from "@/hooks/use-tournaments";

type Trend = { tournament: TournamentListItem; label: "HOT" | "TRENDING" | "UPCOMING"; tone: "crimson" | "gold" | "cobalt" };

/**
 * "Trending" is derived from real tournament state, not fabricated:
 * - LIVE tournaments are labeled HOT.
 * - Among REGISTRATION_OPEN tournaments, the one closest to full (highest
 *   slots-filled ratio) is TRENDING, the rest are UPCOMING.
 * Reuses the same unfiltered /api/tournaments query the rest of the
 * homepage already fetches, so this is a cache hit, not a new request.
 */
export function TrendingTournaments() {
  const { data: tournaments, isLoading } = useTournaments();

  const items: Trend[] = (() => {
    const all = tournaments ?? [];
    const live = all.filter((t) => t.status === "LIVE").map((t): Trend => ({ tournament: t, label: "HOT", tone: "crimson" }));
    const open = [...all.filter((t) => t.status === "REGISTRATION_OPEN")].sort(
      (a, b) => b.slotsFilled / b.maxSlots - a.slotsFilled / a.maxSlots
    );
    const openTrends: Trend[] = open.map((t, i) => ({
      tournament: t,
      label: i === 0 ? "TRENDING" : "UPCOMING",
      tone: i === 0 ? "gold" : "cobalt",
    }));
    return [...live, ...openTrends].slice(0, 6);
  })();

  return (
    <section>
      <SectionHeader title="Trending Tournaments" href="/tournaments" icon={Flame} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-[240px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x -mx-4 px-4 md:grid md:grid-cols-3 md:overflow-visible">
          {items.map(({ tournament: t, label, tone }) => (
            <Link key={t.id} href={`/tournaments/${t.slug}`} className="shrink-0 w-[240px] md:w-auto snap-center">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Card className="overflow-hidden">
                  <div className="relative h-24 gradient-brand flex items-start p-3">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <Badge tone={tone} className="relative z-10">
                      {label === "HOT" && <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" />}
                      {label}
                    </Badge>
                    <span className="relative z-10 ml-auto text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/30 rounded-full px-2 py-1">
                      {t.gameName}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-2">
                    <p className="text-[11px] text-white/45">{formatDateTime(t.matchStartsAt)}</p>
                    <h3 className="font-bold text-white text-sm leading-snug line-clamp-1">{t.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold gradient-text font-mono">{formatPaise(t.prizePool)}</span>
                      <span className="flex items-center gap-1 text-xs text-white/45">
                        <Users className="h-3 w-3" /> {t.maxSlots} Teams
                      </span>
                    </div>
                    <div className="rounded-lg gradient-cta text-center py-1.5 text-xs font-bold text-white flex items-center justify-center gap-1">
                      Join Now <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Flame} title="Nothing trending right now" description="Check back soon for hot and upcoming tournaments." className="py-8" />
      )}
    </section>
  );
}
