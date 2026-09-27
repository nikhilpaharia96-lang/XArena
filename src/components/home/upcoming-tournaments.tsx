"use client";

import { Trophy } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { SectionHeader } from "./section-header";

export function UpcomingTournaments() {
  const { data: upcoming, isLoading } = useTournaments({ status: "REGISTRATION_OPEN" });

  return (
    <section>
      <SectionHeader title="Upcoming Tournaments" href="/tournaments?status=REGISTRATION_OPEN" icon={Trophy} />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-[240px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : upcoming && upcoming.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x -mx-4 px-4">
          {upcoming.slice(0, 10).map((t) => (
            <div key={t.id} className="shrink-0 w-[240px] snap-center">
              <TournamentCard tournament={t} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Trophy} title="No upcoming tournaments" description="New tournaments are added daily — check back soon." />
      )}
    </section>
  );
}
