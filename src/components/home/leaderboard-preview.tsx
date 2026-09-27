"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "./section-header";

const RANK_TONE = ["text-gold", "text-white/70", "text-[#CD7F32]"]; // gold / silver / bronze

/** Ranked by real wins (PlayerStats.wins via /api/leaderboard?type=players),
 * all-time. Not a fabricated "points" system. */
export function LeaderboardPreview() {
  const { data: rows, isLoading } = useLeaderboard("players", "all");
  const top = rows?.slice(0, 5) ?? [];

  return (
    <section>
      <SectionHeader title="Top Players Leaderboard" href="/leaderboard" icon={Trophy} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-[104px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : top.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {top.map((r) => (
            <Link
              key={r.id}
              href="/leaderboard"
              className="shrink-0 w-[104px] rounded-2xl bg-surface border border-white/8 flex flex-col items-center text-center py-3.5 px-2"
            >
              <div className="relative mb-2">
                <div className="h-11 w-11 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    r.username[0]?.toUpperCase()
                  )}
                </div>
                <span
                  className={`absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-void border border-white/15 flex items-center justify-center text-[10px] font-bold ${
                    RANK_TONE[r.rank - 1] ?? "text-white/60"
                  }`}
                >
                  {r.rank}
                </span>
              </div>
              <p className="text-[11px] font-bold text-white truncate w-full">{r.username}</p>
              <p className="text-[10px] text-gold font-semibold mt-1">{r.wins ?? 0} wins</p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No ranked players yet" description="The leaderboard fills up as matches are played." className="py-8" />
      )}
    </section>
  );
}
