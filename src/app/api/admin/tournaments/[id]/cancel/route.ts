import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";

const cancelSchema = z.object({ reason: z.string().trim().min(5).max(300) });

interface TournamentRow {
  id: string;
  status: string;
  entryFee: number;
}
interface ParticipantRow {
  id: string;
  userId: string;
}

/**
 * Cancelling refunds every participant's entry fee in full, credited back
 * to depositBalance (a neutral, always-withdrawable-for-play balance,
 * regardless of which balance types were originally debited — reconstructing
 * the exact original split isn't necessary for a refund to be fair to the
 * user). Each refund is its own Transaction row for a clean audit trail.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const body = await req.json();
    const input = cancelSchema.parse(body);

    const tournament = db.prepare("SELECT id, status, entryFee FROM Tournament WHERE id = ?").get(id) as
      | TournamentRow
      | undefined;
    if (!tournament) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (["COMPLETED", "CANCELLED"].includes(tournament.status)) {
      throw new ApiError(400, "This tournament can't be cancelled.", "INVALID_STATUS");
    }

    const participants = db
      .prepare("SELECT id, userId FROM TournamentParticipant WHERE tournamentId = ?")
      .all(id) as ParticipantRow[];

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare("UPDATE Tournament SET status = 'CANCELLED', adminNotes = ?, updatedAt = ? WHERE id = ?").run(
        input.reason,
        now,
        id
      );

      if (tournament.entryFee > 0) {
        for (const p of participants) {
          db.prepare("UPDATE Wallet SET depositBalance = depositBalance + ?, updatedAt = ? WHERE userId = ?").run(
            tournament.entryFee,
            now,
            p.userId
          );

          const wallet = db
            .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
            .get(p.userId) as { depositBalance: number; winningBalance: number; bonusBalance: number };
          const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;

          db.prepare(
            `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
             VALUES (?, ?, 'REFUND', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
          ).run(
            createId("txn"),
            p.userId,
            tournament.entryFee,
            total,
            createReferenceId("RFD"),
            "Tournament cancelled — entry fee refunded",
            JSON.stringify({ tournamentId: id }),
            now
          );

          db.prepare(
            `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
             VALUES (?, ?, 'ANNOUNCEMENT', ?, ?, ?, ?)`
          ).run(
            createId("notif"),
            p.userId,
            "Tournament cancelled",
            `A tournament you joined was cancelled. Your entry fee has been refunded to your wallet.`,
            JSON.stringify({ tournamentId: id }),
            now
          );
        }
      }
    })();

    writeAuditLog({
      actorId: user.id,
      action: "TOURNAMENT_CANCELLED",
      targetType: "Tournament",
      targetId: id,
      metadata: { reason: input.reason, refundedParticipants: participants.length },
    });

    return ok({ cancelled: true, refundedParticipants: participants.length });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
