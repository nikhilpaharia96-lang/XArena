"use client";

import { use } from "react";
import Link from "next/link";
import { useAdminTournamentDetail } from "@/hooks/use-admin";
import { TournamentWizard } from "@/components/admin/tournament-wizard";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { isoToLocalInput, textToRules, type TournamentForm } from "@/components/admin/tournament-form-model";

interface Row {
  title: string; slug: string; gameId: string; category: string | null; description: string; rules: string;
  bannerUrl: string | null; thumbnailUrl: string | null; mode: string; roomSize: number; map: string | null;
  format: "FREE" | "PAID"; entryFee: number; maxSlots: number; prizePool: number; prizeDistribution: string;
  registrationStartsAt: string; registrationEndsAt: string; matchStartsAt: string; matchEndsAt: string | null;
  cadence: string; isFeatured: number; slotSelection?: number; scoringSystem: string | null; adminNotes: string | null;
  status: string; slotsFilled: number;
}

export default function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, refetch } = useAdminTournamentDetail(id);

  if (isLoading) return <Skeleton className="h-[600px] rounded-3xl" />;
  if (isError || !data) return <ErrorState message="Couldn't load this tournament." onRetry={() => refetch()} />;

  const t = data as unknown as Row;
  if (["LIVE", "COMPLETED", "CANCELLED"].includes(t.status)) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-6 text-sm text-white/70">
        A {t.status.toLowerCase()} tournament can&apos;t be edited.{" "}
        <Link href={`/admin/tournaments/${id}`} className="text-violet underline">Back to tournament</Link>
      </div>
    );
  }

  let prizes: number[] = [];
  try {
    prizes = (JSON.parse(t.prizeDistribution) as { position: number; amount: number }[])
      .sort((a, b) => a.position - b.position)
      .map((p) => p.amount / 100);
  } catch {
    prizes = [];
  }

  const initial: TournamentForm = {
    title: t.title, slug: t.slug, gameId: t.gameId, category: t.category, description: t.description,
    rules: textToRules(t.rules), bannerUrl: t.bannerUrl, thumbnailUrl: t.thumbnailUrl,
    mode: t.mode, roomSize: t.roomSize, map: t.map ?? "", format: t.format, entryFee: t.entryFee / 100,
    maxSlots: t.maxSlots, prizePool: t.prizePool / 100, prizes: prizes.length ? prizes : [0],
    regStarts: isoToLocalInput(t.registrationStartsAt), regEnds: isoToLocalInput(t.registrationEndsAt),
    matchStarts: isoToLocalInput(t.matchStartsAt), matchEnds: isoToLocalInput(t.matchEndsAt),
    cadence: t.cadence, isFeatured: Boolean(t.isFeatured), slotSelection: t.slotSelection === undefined ? true : Boolean(t.slotSelection), scoringSystem: t.scoringSystem ?? "", adminNotes: t.adminNotes ?? "",
  };

  return <TournamentWizard key={id} initial={initial} tournamentId={id} status={t.status} slotsFilled={t.slotsFilled} />;
}
