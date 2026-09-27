import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
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

      // Player stats: every verified result counts as a played match.
      db.prepare(
        `UPDATE PlayerStats SET matchesPlayed = matchesPlayed + 1, kills = kills + ?,
         wins = wins + ?, losses = losses + ?, totalEarnings = totalEarnings + ?, updatedAt = ?
         WHERE userId = ?`
      ).run(result.kills, prizeAmount > 0 ? 1 : 0, prizeAmount > 0 ? 0 : 1, prizeAmount, now, result.userId);

      if (prizeAmount > 0) {
        db.prepare("UPDATE Wallet SET winningBalance = winningBalance + ?, updatedAt = ? WHERE userId = ?").run(
          prizeAmount,
          now,
          result.userId
        );

        const wallet = db
          .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
          .get(result.userId) as { depositBalance: number; winningBalance: number; bonusBalance: number };
        const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;

        db.prepare(
          `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
           VALUES (?, ?, 'TOURNAMENT_PRIZE', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
        ).run(
          createId("txn"),
          result.userId,
          prizeAmount,
          total,
          createReferenceId("PRZ"),
          `Prize for placement #${result.placement}`,
          JSON.stringify({ tournamentId: tournament.id, placement: result.placement }),
          now
        );

        db.prepare(
          `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
           VALUES (?, ?, 'WINNER_ANNOUNCEMENT', ?, ?, ?, ?)`
        ).run(
          createId("notif"),
          result.userId,
          "You won! 🏆",
          `Congratulations! You placed #${result.placement} and won ₹${prizeAmount / 100}.`,
          JSON.stringify({ tournamentId: tournament.id }),
          now
        );
      } else {
        db.prepare(
          `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
           VALUES (?, ?, 'RESULT_PUBLISHED', ?, ?, ?, ?)`
        ).run(
          createId("notif"),
          result.userId,
          "Result verified",
          "Your submitted result has been reviewed and verified.",
          JSON.stringify({ tournamentId: tournament.id }),
          now
        );
      }
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
