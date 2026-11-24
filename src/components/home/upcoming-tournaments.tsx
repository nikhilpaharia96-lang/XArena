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
      <SectionHeader title="Upcoming Tournaments" subtitle="Grab your slot before it fills up" href="/tournaments?status=REGISTRATION_OPEN" />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[22rem] w-[272px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : upcoming && upcoming.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 scroll-px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
          {upcoming.slice(0, 9).map((t) => (
            <div key={t.id} className="shrink-0 w-[272px] snap-start md:w-auto">
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
