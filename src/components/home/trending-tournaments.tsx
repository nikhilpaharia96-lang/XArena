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
import { SlotMeter } from "@/components/tournament/slot-meter";
import { posterForGame } from "./game-card";
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
      <SectionHeader title="Trending Tournaments" subtitle="Hot right now and filling fast" href="/tournaments" icon={Flame} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-[272px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 scroll-px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible">
          {items.map(({ tournament: t, label, tone }) => {
            const poster = t.thumbnailUrl || t.bannerUrl || posterForGame(t.gameSlug, null);
            return (
              <Link key={t.id} href={`/tournaments/${t.slug}`} className="shrink-0 w-[272px] md:w-auto snap-start rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60">
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Card className="overflow-hidden border border-white/10 hover:border-cobalt/40 transition-colors">
                    <div
                      className="force-dark relative h-32 flex items-start p-3"
                      style={
                        poster
                          ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "50% 15%" }
                          : undefined
                      }
                    >
                      {!poster && <div className="absolute inset-0 gradient-brand" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
                      <Badge tone={tone} className="relative z-10 bg-black/65 backdrop-blur-sm">
                        {label === "HOT" && <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" />}
                        {label}
                      </Badge>
                      <span className="relative z-10 ml-auto text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/30 rounded-full px-2 py-1">
                        {t.gameName}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <p className="text-[11px] text-white/45">{formatDateTime(t.matchStartsAt)}</p>
                      <h3 className="font-bold text-white text-sm leading-snug line-clamp-1">{t.title}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold gradient-text font-mono">{formatPaise(t.prizePool)}</span>
                        <span className="flex items-center gap-1 text-xs text-white/45">
                          <Users className="h-3 w-3" /> {t.slotsFilled}/{t.maxSlots} joined
                        </span>
                      </div>
                      <SlotMeter filled={t.slotsFilled} max={t.maxSlots} />
                      <div className="rounded-xl gradient-cta text-center h-10 text-sm font-bold text-white flex items-center justify-center gap-1.5">
                        Join Now <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Flame} title="Nothing trending right now" description="Check back soon for hot and upcoming tournaments." className="py-8" />
      )}
    </section>
  );
}
