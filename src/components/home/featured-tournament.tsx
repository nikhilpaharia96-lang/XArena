"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Flame, ShieldCheck, Users } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise, formatDateTime, gameModeLabel } from "@/lib/format";
import { SectionHeader } from "./section-header";

/**
 * One large "hero card" for a single real featured tournament
 * (Tournament.isFeatured, same flag the hero carousel's promo slides use).
 * Renders nothing when there isn't one instead of inventing a placeholder.
 */
export function FeaturedTournament() {
  const { data: featured, isLoading } = useTournaments({ featured: true });
  const t = featured?.[0];

  if (isLoading) {
    return <Skeleton className="h-64 rounded-3xl" />;
  }

  if (!t) return null;

  return (
    <section>
      <SectionHeader title="Featured Tournament" href="/tournaments?featured=1" icon={Flame} />
      <Link href={`/tournaments/${t.slug}`}>
        <motion.div whileTap={{ scale: 0.99 }} className="relative rounded-3xl overflow-hidden border border-gold/20">
          <div
            className="absolute inset-0"
            style={
              t.bannerUrl
                ? { backgroundImage: `url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: "linear-gradient(135deg, var(--color-violet-dim), var(--color-void))" }
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />

          <div className="relative p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-void">
                Featured
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/30 rounded-full px-2.5 py-1">
                {t.gameName}
              </span>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-white font-display font-extrabold text-2xl leading-tight">
                {t.title}
                {t.slotsFilled > t.maxSlots * 0.5 && <ShieldCheck className="h-5 w-5 text-cobalt shrink-0" />}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-white/75">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> {formatDateTime(t.matchStartsAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {t.maxSlots} Slots
                </span>
                <span className="text-gold font-bold">{formatPaise(t.prizePool)} Prize Pool</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-lg bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/85">
                  {gameModeLabel(t.mode)}
                </span>
                <span className="rounded-lg bg-signal/15 border border-signal/30 px-2.5 py-1 text-[11px] font-semibold text-signal">
                  {t.format === "FREE" ? "Free Entry" : `Entry: ${formatPaise(t.entryFee)}`}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 shrink-0 rounded-xl gradient-cta px-4 h-10 text-sm font-bold text-white">
                Join Now <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </motion.div>
      </Link>
    </section>
  );
}
