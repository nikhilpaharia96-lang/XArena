"use client";

import { Gamepad2, Trophy, Users, Wallet2 } from "lucide-react";
import { useGames, useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber, formatPaise } from "@/lib/format";

/**
 * Every number here is derived from the same tournaments/games data the
 * rest of the homepage already fetches — nothing is hardcoded. "Players"
 * is approximated as total slots filled across all live/open tournaments,
 * since there's no public "total users" endpoint yet.
 */
export function StatsStrip() {
  const { data: tournaments, isLoading: tLoading } = useTournaments();
  const { data: games, isLoading: gLoading } = useGames();
  const loading = tLoading || gLoading;

  const tournamentCount = tournaments?.length ?? 0;
  const playersJoined = tournaments?.reduce((sum, t) => sum + t.slotsFilled, 0) ?? 0;
  const totalPrizePool = tournaments?.reduce((sum, t) => sum + t.prizePool, 0) ?? 0;
  const gameCount = games?.length ?? 0;

  const stats = [
    { icon: Trophy, value: formatCompactNumber(tournamentCount), label: "Tournaments" },
    { icon: Users, value: formatCompactNumber(playersJoined), label: "Players Joined" },
    { icon: Wallet2, value: formatPaise(totalPrizePool), label: "Prize Pool" },
    { icon: Gamepad2, value: String(gameCount), label: "Games" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-surface border border-white/8 flex flex-col items-center justify-center text-center py-3 px-1">
          <s.icon className="h-4 w-4 text-gold mb-1.5" />
          <p className="text-sm sm:text-base font-extrabold text-white leading-none">{s.value}</p>
          <p className="text-[9px] sm:text-[10px] text-white/45 mt-1 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
