import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { applyPayout } from "@/server/lib/match-settlement";
import { writeAuditLog } from "@/server/lib/audit";

interface ResultRow {
  id: string;
  matchId: string;
  userId: string;
  placement: number | null;
  kills: number;
  verifiedAt: string | null;
}
interface MatchRow {
  id: string;
  tournamentId: string;
}
interface TournamentRow {
  id: string;
  prizeDistribution: string;
}
interface PrizeEntry {
  position: number;
  amount: number;
}

/**
 * The payout core of the platform. Verifying a result:
 *  1. Marks it verified (audit trail of who verified, when).
 *  2. Looks up the tournament's prizeDistribution table; if this player's
 *     placement matches a paid position, credits winningBalance with that
 *     exact amount — winnings only ever land in winningBalance, never
 *     depositBalance, so the withdrawal-eligibility rule stays correct.
 *  3. Updates the player's aggregate PlayerStats (matchesPlayed, wins,
 *     kills, totalEarnings) so the profile/leaderboard reflect it
 *     immediately.
 * All of this happens in one DB transaction — a verified result with no
 * payout, or a payout with no stats update, should never be observable.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;

    const result = db
      .prepare("SELECT id, matchId, userId, placement, kills, verifiedAt FROM MatchResult WHERE id = ?")
      .get(id) as ResultRow | undefined;
    if (!result) throw new ApiError(404, "Result not found.", "NOT_FOUND");
    if (result.verifiedAt) throw new ApiError(400, "This result has already been verified.", "ALREADY_VERIFIED");

    const match = db.prepare("SELECT id, tournamentId FROM Match WHERE id = ?").get(result.matchId) as
      | MatchRow
      | undefined;
    if (!match) throw new ApiError(404, "Match not found.", "NOT_FOUND");

    const tournament = db
      .prepare("SELECT id, prizeDistribution FROM Tournament WHERE id = ?")
      .get(match.tournamentId) as TournamentRow;

    const prizeTable: PrizeEntry[] = JSON.parse(tournament.prizeDistribution);
    const prizeEntry = result.placement ? prizeTable.find((p) => p.position === result.placement) : undefined;
    const prizeAmount = prizeEntry?.amount ?? 0;

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare("UPDATE MatchResult SET verifiedByAdminId = ?, verifiedAt = ? WHERE id = ?").run(
        admin.id,
        now,
        id
      );
      db.prepare("UPDATE Match SET status = 'RESULT_VERIFIED', updatedAt = ? WHERE id = ?").run(now, match.id);

      applyPayout(db, {
        adminId: admin.id,
        tournamentId: tournament.id,
        userId: result.userId,
        placement: result.placement,
        kills: result.kills,
        prizeAmount,
        now,
      });
    })();

    writeAuditLog({
      actorId: admin.id,
      action: "RESULT_VERIFIED",
      targetType: "MatchResult",
      targetId: id,
      metadata: { prizeAmount, placement: result.placement },
    });

    return ok({ verified: true, prizeAwarded: prizeAmount });
  } catch (error) {
    return fail(error);
  }
}
