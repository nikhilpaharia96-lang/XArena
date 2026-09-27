"use client";

import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveMatchCard } from "./live-match-card";
import { SectionHeader } from "./section-header";

/**
 * Backed by real tournaments with status === "LIVE" (Tournament.status has
 * a LIVE value in the schema). This app's match model doesn't carry a
 * cricket-style score (runs/wickets/overs) — it's a kills/placement
 * battle-royale format — so the card shows real joined-slot counts and
 * mode instead of fabricated scores.
 */
export function LiveMatches() {
  const { data: live, isLoading } = useTournaments({ status: "LIVE" });

  return (
    <section>
      <SectionHeader
        title="Live Matches"
        href="/tournaments?status=LIVE"
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-crimson px-2 py-0.5 text-[10px] font-bold text-white">
            <Radio className="h-2.5 w-2.5" /> LIVE
          </span>
        }
      />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-[280px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : live && live.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x -mx-4 px-4">
          {live.map((t) => (
            <LiveMatchCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-surface border border-white/8 py-8 text-center px-4">
          <p className="text-white/70 font-semibold text-sm">No live matches right now</p>
          <Link
            href="/tournaments?status=REGISTRATION_OPEN"
            className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-violet"
          >
            View Upcoming Matches <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </section>
  );
}
