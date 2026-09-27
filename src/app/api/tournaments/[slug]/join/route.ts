import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { joinTournamentSchema } from "@/types/schemas";

interface TournamentRow {
  id: string;
  status: string;
  entryFee: number;
  maxSlots: number;
  slotsFilled: number;
  registrationStartsAt: string;
  registrationEndsAt: string;
}
interface WalletRow {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
}

/**
 * Joining a tournament is the single most safety-critical write in the
 * platform: it moves money and reserves a scarce slot. Everything below
 * happens inside one SQLite transaction so a crash mid-request can never
 * leave a half-joined state (slot reserved but no fee charged, or vice
 * versa). The UNIQUE(tournamentId, userId) constraint on
 * TournamentParticipant is the final backstop against double-join races
 * even if two requests land concurrently.
 */
export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`join:${getClientKey(req)}:${user.id}`, 10, 60_000);
    if (!allowed) {
      throw new ApiError(429, "Too many requests. Please slow down.");
    }

    const { slug } = await context.params;
    const body = await req.json().catch(() => ({}));
    const input = joinTournamentSchema.parse(body);

    const tournament = db
      .prepare(
        `SELECT id, status, entryFee, maxSlots, slotsFilled, registrationStartsAt, registrationEndsAt
         FROM Tournament WHERE slug = ?`
      )
      .get(slug) as TournamentRow | undefined;

    if (!tournament) {
      throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    }

    const now = new Date();
    if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(tournament.status)) {
      throw new ApiError(400, "Registration is not open for this tournament.", "REGISTRATION_CLOSED");
    }
    if (now < new Date(tournament.registrationStartsAt)) {
      throw new ApiError(400, "Registration hasn't started yet.", "REGISTRATION_NOT_STARTED");
    }
    if (now > new Date(tournament.registrationEndsAt)) {
      throw new ApiError(400, "Registration has closed for this tournament.", "REGISTRATION_CLOSED");
    }
    if (tournament.slotsFilled >= tournament.maxSlots) {
      throw new ApiError(400, "This tournament is full.", "TOURNAMENT_FULL");
    }

    const existing = db
      .prepare("SELECT id FROM TournamentParticipant WHERE tournamentId = ? AND userId = ?")
      .get(tournament.id, user.id);
    if (existing) {
      throw new ApiError(409, "You've already joined this tournament.", "ALREADY_JOINED");
    }

    let entryTxnId: string | null = null;
    const nowIso = now.toISOString();

    const runJoin = db.transaction(() => {
      if (tournament.entryFee > 0) {
        const wallet = db
          .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
          .get(user.id) as WalletRow;

        const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;
        if (total < tournament.entryFee) {
          throw new ApiError(402, "Insufficient wallet balance. Please add money to join.", "INSUFFICIENT_BALANCE");
        }

        // Debit order: bonus balance first (non-withdrawable, spend it first),
        // then deposit balance, then winning balance last (most valuable to
        // the user since it's directly withdrawable).
        let remaining = tournament.entryFee;
        let newBonus = wallet.bonusBalance;
        let newDeposit = wallet.depositBalance;
        let newWinning = wallet.winningBalance;

        const fromBonus = Math.min(newBonus, remaining);
        newBonus -= fromBonus;
        remaining -= fromBonus;

        const fromDeposit = Math.min(newDeposit, remaining);
        newDeposit -= fromDeposit;
        remaining -= fromDeposit;

        const fromWinning = Math.min(newWinning, remaining);
        newWinning -= fromWinning;
        remaining -= fromWinning;

        db.prepare(
          `UPDATE Wallet SET depositBalance = ?, winningBalance = ?, bonusBalance = ?, updatedAt = ? WHERE userId = ?`
        ).run(newDeposit, newWinning, newBonus, nowIso, user.id);

        entryTxnId = createId("txn");
        db.prepare(
          `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
           VALUES (?, ?, 'TOURNAMENT_ENTRY', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
        ).run(
          entryTxnId,
          user.id,
          tournament.entryFee,
          newDeposit + newWinning + newBonus,
          createReferenceId("ENT"),
          "Tournament entry fee",
          JSON.stringify({ tournamentId: tournament.id }),
          nowIso
        );
      }

      const participantId = createId("part");
      db.prepare(
        `INSERT INTO TournamentParticipant (id, tournamentId, userId, teamName, status, entryTxnId, joinedAt)
         VALUES (?, ?, ?, ?, 'REGISTERED', ?, ?)`
      ).run(participantId, tournament.id, user.id, input.teamName ?? null, entryTxnId, nowIso);

      db.prepare("UPDATE Tournament SET slotsFilled = slotsFilled + 1, updatedAt = ? WHERE id = ?").run(
        nowIso,
        tournament.id
      );

      // Auto-transition to REGISTRATION_OPEN on first join if still just PUBLISHED.
      db.prepare(
        `UPDATE Tournament SET status = 'REGISTRATION_OPEN' WHERE id = ? AND status = 'PUBLISHED'`
      ).run(tournament.id);

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
         VALUES (?, ?, 'TOURNAMENT_REMINDER', ?, ?, ?, ?)`
      ).run(
        createId("notif"),
        user.id,
        "You're in! 🎮",
        "You've successfully joined the tournament. Room details will be shared closer to match time.",
        JSON.stringify({ tournamentId: tournament.id }),
        nowIso
      );

      return participantId;
    });

    const participantId = runJoin();

    return ok({ joined: true, participantId }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    // SQLite raises this on UNIQUE constraint violation — final backstop
    // against a race where two requests both pass the existence check.
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return fail(new ApiError(409, "You've already joined this tournament.", "ALREADY_JOINED"));
    }
    return fail(error);
  }
}
