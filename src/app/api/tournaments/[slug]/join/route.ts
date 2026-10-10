import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { registrationBlock, type TournamentSlotRow } from "@/server/lib/slots";
import { joinTournamentSchema } from "@/types/schemas";
import { validateGameUid } from "@/lib/game-uid";
import { buildLayout, firstFreePosition, positionLabel, positionsInSlot, slotKey, slotLabel } from "@/lib/slot-layout";

interface WalletRow {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
}

/**
 * Joining a tournament is the single most safety-critical write in the platform: it moves
 * money and reserves a scarce slot. Everything happens inside ONE immediate SQLite
 * transaction, in this order:
 *
 *   1. re-validate the tournament (status, dates, capacity) against fresh rows
 *   2. reserve the slot  (UNIQUE(tournamentId, slotNumber, position) is the DB-level backstop)
 *   3. only then debit the wallet
 *
 * If any step throws — slot just taken, insufficient balance, anything — the whole
 * transaction rolls back, so the player is never charged for a registration that failed.
 */
export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`join:${getClientKey(req)}:${user.id}`, 10, 60_000);
    if (!allowed) throw new ApiError(429, "Too many requests. Please slow down.");

    const { slug } = await context.params;
    const input = joinTournamentSchema.parse(await req.json().catch(() => ({})));

    const head = db
      .prepare(`SELECT t.id, g.slug AS gameSlug FROM Tournament t JOIN Game g ON g.id = t.gameId WHERE t.slug = ? AND t.status != 'DRAFT'`)
      .get(slug) as { id: string; gameSlug: string } | undefined;
    if (!head) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const uidProblem = validateGameUid(head.gameSlug, input.gameUid);
    if (uidProblem) throw new ApiError(400, uidProblem, "INVALID_GAME_UID");

    const runJoin = db.transaction(() => {
      const nowDate = new Date();
      const nowIso = nowDate.toISOString();

      // 1. Fresh read inside the write lock — never trust anything read before the transaction.
      const t = db
        .prepare(
          `SELECT id, slug, title, status, mode, format, roomSize, maxSlots, slotsFilled, entryFee, slotSelection,
                  registrationStartsAt, registrationEndsAt
           FROM Tournament WHERE id = ?`
        )
        .get(head.id) as TournamentSlotRow;

      const block = registrationBlock(t, nowDate);
      if (block) throw new ApiError(400, block.message, block.code);

      if (db.prepare("SELECT id FROM TournamentParticipant WHERE tournamentId = ? AND userId = ?").get(t.id, user.id)) {
        throw new ApiError(409, "You've already joined this tournament.", "ALREADY_JOINED");
      }

      const layout = buildLayout(t.mode, t.roomSize, t.maxSlots);
      const takenRows = db
        .prepare("SELECT slotNumber, position FROM TournamentParticipant WHERE tournamentId = ? AND slotNumber IS NOT NULL")
        .all(t.id) as { slotNumber: number; position: number }[];
      const taken = new Set(takenRows.map((r) => slotKey(r.slotNumber, r.position)));
      const locked = new Set(
        (db.prepare("SELECT slotNumber FROM TournamentSlotLock WHERE tournamentId = ?").all(t.id) as { slotNumber: number }[]).map((r) => r.slotNumber)
      );

      // 2. Decide the seat.
      let slotNumber: number;
      let position: number;
      if (t.slotSelection) {
        if (!input.slotNumber || !input.position) {
          throw new ApiError(400, "Please select a slot to join.", "SLOT_REQUIRED");
        }
        slotNumber = input.slotNumber;
        position = input.position;
        if (position > positionsInSlot(layout, slotNumber)) {
          throw new ApiError(400, "That slot doesn't exist in this tournament.", "SLOT_INVALID");
        }
      } else {
        const spot = firstFreePosition(layout, taken, locked);
        if (!spot) throw new ApiError(400, "This tournament is full.", "TOURNAMENT_FULL");
        slotNumber = spot.slotNumber;
        position = spot.position;
      }

      const label = `${slotLabel(layout, slotNumber)}${layout.teamSize > 1 ? ` · Player ${positionLabel(position)}` : ""}`;
      if (locked.has(slotNumber)) {
        throw new ApiError(409, `${slotLabel(layout, slotNumber)} is locked. Please choose another slot.`, "SLOT_LOCKED");
      }
      if (taken.has(slotKey(slotNumber, position))) {
        throw new ApiError(409, `${label} was just taken. Please choose another slot.`, "SLOT_TAKEN");
      }

      // Reserve the seat first (the unique index rejects a duplicate even under a race).
      const participantId = createId("part");
      db.prepare(
        `INSERT INTO TournamentParticipant (id, tournamentId, userId, teamName, status, entryTxnId, slotNumber, position, ign, gameUid, joinedAt)
         VALUES (?, ?, ?, ?, 'REGISTERED', NULL, ?, ?, ?, ?, ?)`
      ).run(participantId, t.id, user.id, input.teamName ?? null, slotNumber, position, input.ign, input.gameUid, nowIso);

      // 3. Charge the entry fee — only after the seat is secured.
      let entryTxnId: string | null = null;
      if (t.entryFee > 0) {
        const wallet = db
          .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
          .get(user.id) as WalletRow | undefined;
        const total = wallet ? wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance : 0;
        if (!wallet || total < t.entryFee) {
          throw new ApiError(402, "Insufficient wallet balance. Please add money to join.", "INSUFFICIENT_BALANCE");
        }

        // Debit order: bonus first (non-withdrawable), then deposit, then winnings (most valuable) last.
        let remaining = t.entryFee;
        let newBonus = wallet.bonusBalance;
        let newDeposit = wallet.depositBalance;
        let newWinning = wallet.winningBalance;
        const fromBonus = Math.min(newBonus, remaining);
        newBonus -= fromBonus;
        remaining -= fromBonus;
        const fromDeposit = Math.min(newDeposit, remaining);
        newDeposit -= fromDeposit;
        remaining -= fromDeposit;
        newWinning -= Math.min(newWinning, remaining);

        db.prepare("UPDATE Wallet SET depositBalance = ?, winningBalance = ?, bonusBalance = ?, updatedAt = ? WHERE userId = ?").run(
          newDeposit, newWinning, newBonus, nowIso, user.id
        );

        entryTxnId = createId("txn");
        db.prepare(
          `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
           VALUES (?, ?, 'TOURNAMENT_ENTRY', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
        ).run(
          entryTxnId, user.id, t.entryFee, newDeposit + newWinning + newBonus, createReferenceId("ENT"),
          "Tournament entry fee", JSON.stringify({ tournamentId: t.id, slotNumber, position }), nowIso
        );
        db.prepare("UPDATE TournamentParticipant SET entryTxnId = ? WHERE id = ?").run(entryTxnId, participantId);
      }

      db.prepare("UPDATE Tournament SET slotsFilled = slotsFilled + 1, updatedAt = ? WHERE id = ?").run(nowIso, t.id);
      // Auto-transition to REGISTRATION_OPEN on first join if still just PUBLISHED.
      db.prepare(`UPDATE Tournament SET status = 'REGISTRATION_OPEN' WHERE id = ? AND status = 'PUBLISHED'`).run(t.id);

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
         VALUES (?, ?, 'TOURNAMENT_REMINDER', ?, ?, ?, ?)`
      ).run(
        createId("notif"), user.id, "You're in! 🎮",
        `You've joined ${t.title} (${label}). Room details will be shared closer to match time.`,
        JSON.stringify({ tournamentId: t.id }), nowIso
      );

      return {
        participantId,
        tournamentId: t.id,
        tournamentTitle: t.title,
        entryFee: t.entryFee,
        slotNumber,
        position,
        slotLabel: slotLabel(layout, slotNumber),
        positionLabel: positionLabel(position),
        teamSize: layout.teamSize,
        status: "REGISTERED",
      };
    });

    // .immediate() takes the write lock up front, so two simultaneous joins are fully serialised.
    return ok({ joined: true, ...runJoin.immediate() }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      // Backstop: the DB itself refused a duplicate seat or a duplicate join.
      const seat = error.message.includes("slotNumber");
      return fail(
        seat
          ? new ApiError(409, "That slot was just taken. Please choose another slot.", "SLOT_TAKEN")
          : new ApiError(409, "You've already joined this tournament.", "ALREADY_JOINED")
      );
    }
    return fail(validationError(error) ?? error);
  }
}
