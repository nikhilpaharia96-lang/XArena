"use client";

import { useState } from "react";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Crown, Medal, Trophy } from "lucide-react";

const TYPES = [
  { key: "winners", label: "Top Winners" },
  { key: "players", label: "Top Players" },
  { key: "referrers", label: "Top Referrers" },
] as const;

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all", label: "All Time" },
] as const;

const rankStyles = ["text-gold", "text-white/70", "text-[#CD7F32]"];

export default function LeaderboardPage() {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("winners");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("weekly");
  const { data, isLoading } = useLeaderboard(type, period);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-black text-white flex items-center gap-2">
        <Trophy className="h-5 w-5 text-gold" /> Leaderboard
      </h1>

      <div className="flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={cn(
              "flex-1 h-10 rounded-xl text-xs font-bold transition-colors",
              type === t.key ? "gradient-brand text-white" : "bg-white/5 text-white/60 border border-white/10"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "px-3.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors",
              period === p.key ? "bg-violet/20 text-violet border border-violet/40" : "bg-white/5 text-white/50 border border-white/10"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((row) => (
            <Card key={row.id} className="p-3.5 flex items-center gap-3">
              <div className="w-8 flex justify-center shrink-0">
                {row.rank <= 3 ? (
                  <Medal className={cn("h-5 w-5", rankStyles[row.rank - 1])} />
                ) : (
                  <span className="text-sm font-bold text-white/40">#{row.rank}</span>
                )}
              </div>
              <div className="h-10 w-10 rounded-full gradient-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
                {row.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{row.username}</p>
                <p className="text-xs text-white/40">
                  {type === "winners" && `${row.prizesWon} prizes won`}
                  {type === "players" && `${row.matchesPlayed} matches · ${row.wins} wins`}
                  {type === "referrers" && `${row.referralCount} referrals`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-bold text-signal text-sm">
                  {type === "winners" && formatPaise(row.totalWinnings ?? 0)}
                  {type === "players" && `${((row.winRate ?? 0) * 100).toFixed(0)}% WR`}
                  {type === "referrers" && formatPaise(row.totalEarned ?? 0)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Crown} title="No data yet for this period" description="Rankings will appear as players compete." />
      )}
    </div>
  );
}
