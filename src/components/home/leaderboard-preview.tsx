"use client";

import Link from "next/link";
import { Crown, Trophy } from "lucide-react";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "./section-header";

/** Visual treatment per rank: top 3 get a crown + tinted card, 4-5 are plain. */
const TIERS = [
  { crown: "#F5B400", card: "bg-gradient-to-b from-gold/20 via-gold/5 to-surface border-gold/30", ring: "ring-gold", badge: "bg-gold text-void" },
  { crown: "#D7DEE8", card: "bg-surface border-white/12", ring: "ring-[#D7DEE8]/70", badge: "bg-[#D7DEE8] text-void" },
  { crown: "#F97316", card: "bg-gradient-to-b from-[#F97316]/20 via-[#F97316]/5 to-surface border-[#F97316]/30", ring: "ring-[#F97316]", badge: "bg-[#F97316] text-white" },
  { crown: null, card: "bg-surface border-white/8", ring: "ring-cobalt/60", badge: "bg-cobalt text-white" },
  { crown: null, card: "bg-surface border-white/8", ring: "ring-white/20", badge: "bg-void text-white border border-white/20" },
] as const;
const FALLBACK_TIER = TIERS[4];

/** Ranked by real wins (PlayerStats.wins via /api/leaderboard?type=players),
 * all-time. Not a fabricated "points" system. */
export function LeaderboardPreview() {
  const { data: rows, isLoading } = useLeaderboard("players", "all");
  const top = rows?.slice(0, 5) ?? [];

  return (
    <section>
      <SectionHeader title="Top Players Leaderboard" href="/leaderboard" icon={Crown} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-[124px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : top.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {top.map((r) => {
            const tier = TIERS[r.rank - 1] ?? FALLBACK_TIER;
            return (
              <Link
                key={r.id}
                href="/leaderboard"
                className={`relative shrink-0 w-[124px] rounded-2xl border overflow-hidden flex flex-col items-center text-center pt-3 pb-4 px-2 ${tier.card}`}
              >
                {/* Decorative shield behind the avatar */}
                <div
                  aria-hidden
                  className="absolute left-1/2 top-9 -translate-x-1/2 h-16 w-20 bg-white/5"
                  style={{ clipPath: "polygon(50% 0%, 100% 15%, 100% 75%, 50% 100%, 0% 75%, 0% 15%)" }}
                />

                <div className="relative h-4 flex items-center justify-center mb-1">
                  {tier.crown && <Crown className="h-4 w-4" style={{ color: tier.crown, fill: tier.crown }} />}
                </div>

                <div className={`relative h-14 w-14 rounded-full ring-2 ${tier.ring} overflow-hidden bg-surface-2 flex items-center justify-center`}>
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">{r.username[0]?.toUpperCase()}</span>
                  )}
                </div>

                <span className={`relative -mt-3 mb-1.5 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-void ${tier.badge}`}>
                  {r.rank}
                </span>

                <p className="relative text-[11px] font-bold text-white truncate w-full">{r.username}</p>
                <p className="relative flex items-center justify-center gap-1 text-[10px] text-gold font-semibold mt-1">
                  <Trophy className="h-3 w-3" /> {(r.wins ?? 0).toLocaleString("en-IN")}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No ranked players yet" description="The leaderboard fills up as matches are played." className="py-8" />
      )}
    </section>
  );
}
