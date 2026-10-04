import { paiseToRupees } from "@/server/lib/money";

/** Raw Tournament DB row (money in paise, prizeDistribution as JSON text). */
export type TournamentRow = Record<string, unknown> & {
  id: string;
  status: string;
  slotsFilled: number;
  entryFee: number;
  prizePool: number;
  prizeDistribution: string;
};

/** Converts a DB row into the input shape used by the admin schemas (rupees, parsed prizes). */
export function rowToFields(row: TournamentRow) {
  let dist: { position: number; amount: number }[] = [];
  try {
    dist = JSON.parse(row.prizeDistribution) as { position: number; amount: number }[];
  } catch {
    dist = [];
  }
  return {
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string,
    bannerUrl: (row.bannerUrl as string | null) ?? null,
    thumbnailUrl: (row.thumbnailUrl as string | null) ?? null,
    gameId: row.gameId as string,
    mode: row.mode as string,
    format: row.format as string,
    cadence: row.cadence as string,
    entryFeeRupees: paiseToRupees(row.entryFee),
    prizePoolRupees: paiseToRupees(row.prizePool),
    prizeDistribution: dist.map((p) => ({ position: p.position, amountRupees: paiseToRupees(p.amount) })),
    maxSlots: row.maxSlots as number,
    roomSize: row.roomSize as number,
    map: (row.map as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    rules: row.rules as string,
    scoringSystem: (row.scoringSystem as string | null) ?? null,
    registrationStartsAt: row.registrationStartsAt as string,
    registrationEndsAt: row.registrationEndsAt as string,
    matchStartsAt: row.matchStartsAt as string,
    matchEndsAt: (row.matchEndsAt as string | null) || null,
    isFeatured: Boolean(row.isFeatured),
    adminNotes: (row.adminNotes as string | null) ?? null,
  };
}
