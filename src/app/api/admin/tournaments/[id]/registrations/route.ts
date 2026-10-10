import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { buildBoard, getTournamentForSlots, registrationBlock } from "@/server/lib/slots";
import { buildLayout, positionsInSlot, slotLabel } from "@/lib/slot-layout";

type Ctx = { params: Promise<{ id: string }> };

/** Admin view of the same board players see — built by the same function, from the same tables. */
export async function GET(_req: Request, context: Ctx) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const t = getTournamentForSlots({ id });
    if (!t) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const board = buildBoard(t, { viewerId: null, admin: true, accepting: true });
    const unseated = db
      .prepare(
        `SELECT tp.id AS participantId, tp.userId, u.username, tp.ign, tp.gameUid, tp.joinedAt, tp.status
         FROM TournamentParticipant tp JOIN User u ON u.id = tp.userId
         WHERE tp.tournamentId = ? AND tp.slotNumber IS NULL ORDER BY tp.joinedAt`
      )
      .all(t.id);

    return ok({
      tournament: { id: t.id, slug: t.slug, title: t.title, status: t.status, mode: t.mode, entryFee: t.entryFee },
      slotSelection: Boolean(t.slotSelection),
      registrationOpen: ["PUBLISHED", "REGISTRATION_OPEN"].includes(t.status),
      canAcceptNow: registrationBlock(t) === null,
      editable: !["LIVE", "COMPLETED", "CANCELLED"].includes(t.status),
      ...board,
      unseated,
    });
  } catch (error) {
    return fail(error);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lock"), slotNumber: z.number().int().min(1) }),
  z.object({ action: z.literal("unlock"), slotNumber: z.number().int().min(1) }),
  z.object({ action: z.literal("move"), participantId: z.string().min(1), slotNumber: z.number().int().min(1), position: z.number().int().min(1) }),
  z.object({ action: z.literal("remove"), participantId: z.string().min(1), refund: z.boolean().default(true) }),
  z.object({ action: z.literal("registration"), open: z.boolean() }),
]);

export async function POST(req: Request, context: Ctx) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const input = actionSchema.parse(await req.json().catch(() => ({})));

    const result = db
      .transaction(() => {
        const t = getTournamentForSlots({ id });
        if (!t) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
        if (["LIVE", "COMPLETED", "CANCELLED"].includes(t.status)) {
          throw new ApiError(400, "Registrations can't be changed once the tournament is live, completed or cancelled.", "NOT_EDITABLE");
        }
        const layout = buildLayout(t.mode, t.roomSize, t.maxSlots);
        const nowIso = new Date().toISOString();
        const audit = (action: string, metadata: Record<string, unknown>) =>
          writeAuditLog({ actorId: user.id, action, targetType: "Tournament", targetId: t.id, metadata });

        switch (input.action) {
          case "registration": {
            if (input.open) {
              if (t.status !== "REGISTRATION_CLOSED") throw new ApiError(400, "Registration is already open (or the tournament isn't published yet).", "INVALID_STATE");
              db.prepare("UPDATE Tournament SET status = 'REGISTRATION_OPEN', updatedAt = ? WHERE id = ?").run(nowIso, t.id);
            } else {
              if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(t.status)) throw new ApiError(400, "Registration isn't open.", "INVALID_STATE");
              db.prepare("UPDATE Tournament SET status = 'REGISTRATION_CLOSED', updatedAt = ? WHERE id = ?").run(nowIso, t.id);
            }
            audit(input.open ? "REGISTRATION_OPENED" : "REGISTRATION_CLOSED", {});
            return { registrationOpen: input.open };
          }

          case "lock": {
            if (positionsInSlot(layout, input.slotNumber) === 0) throw new ApiError(404, "That slot doesn't exist.", "SLOT_INVALID");
            const occupied = db.prepare("SELECT 1 FROM TournamentParticipant WHERE tournamentId = ? AND slotNumber = ?").get(t.id, input.slotNumber);
            if (occupied) throw new ApiError(409, `${slotLabel(layout, input.slotNumber)} has registered players. Move or remove them before locking it.`, "SLOT_OCCUPIED");
            db.prepare("INSERT OR IGNORE INTO TournamentSlotLock (tournamentId, slotNumber, lockedById, createdAt) VALUES (?, ?, ?, ?)").run(t.id, input.slotNumber, user.id, nowIso);
            audit("SLOT_LOCKED", { slotNumber: input.slotNumber });
            return { locked: true };
          }

          case "unlock": {
            db.prepare("DELETE FROM TournamentSlotLock WHERE tournamentId = ? AND slotNumber = ?").run(t.id, input.slotNumber);
            audit("SLOT_UNLOCKED", { slotNumber: input.slotNumber });
            return { locked: false };
          }

          case "move": {
            const p = db.prepare("SELECT id, userId, slotNumber, position FROM TournamentParticipant WHERE id = ? AND tournamentId = ?").get(input.participantId, t.id) as
              | { id: string; userId: string; slotNumber: number | null; position: number | null } | undefined;
            if (!p) throw new ApiError(404, "Registration not found.", "NOT_FOUND");
            if (input.position > positionsInSlot(layout, input.slotNumber)) throw new ApiError(400, "That slot/position doesn't exist.", "SLOT_INVALID");
            if (db.prepare("SELECT 1 FROM TournamentSlotLock WHERE tournamentId = ? AND slotNumber = ?").get(t.id, input.slotNumber)) {
              throw new ApiError(409, `${slotLabel(layout, input.slotNumber)} is locked. Unlock it first.`, "SLOT_LOCKED");
            }
            const taken = db.prepare("SELECT id FROM TournamentParticipant WHERE tournamentId = ? AND slotNumber = ? AND position = ?").get(t.id, input.slotNumber, input.position) as { id: string } | undefined;
            if (taken && taken.id !== p.id) throw new ApiError(409, "That position is already taken by another player.", "SLOT_TAKEN");
            db.prepare("UPDATE TournamentParticipant SET slotNumber = ?, position = ? WHERE id = ?").run(input.slotNumber, input.position, p.id);
            db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'ANNOUNCEMENT', ?, ?, ?, ?)`).run(
              createId("notif"), p.userId, "Your slot was changed",
              `An admin moved you to ${slotLabel(layout, input.slotNumber)} in ${t.title}.`, JSON.stringify({ tournamentId: t.id }), nowIso
            );
            audit("REGISTRATION_MOVED", { participantId: p.id, from: { slotNumber: p.slotNumber, position: p.position }, to: { slotNumber: input.slotNumber, position: input.position } });
            return { moved: true };
          }

          case "remove": {
            const p = db.prepare("SELECT id, userId, entryTxnId FROM TournamentParticipant WHERE id = ? AND tournamentId = ?").get(input.participantId, t.id) as
              | { id: string; userId: string; entryTxnId: string | null } | undefined;
            if (!p) throw new ApiError(404, "Registration not found.", "NOT_FOUND");

            let refunded = 0;
            // Refund mirrors the existing tournament-cancel logic: back to deposit balance + a REFUND transaction.
            if (input.refund && t.entryFee > 0 && p.entryTxnId) {
              db.prepare("UPDATE Wallet SET depositBalance = depositBalance + ?, updatedAt = ? WHERE userId = ?").run(t.entryFee, nowIso, p.userId);
              const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(p.userId) as { depositBalance: number; winningBalance: number; bonusBalance: number };
              db.prepare(
                `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
                 VALUES (?, ?, 'REFUND', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
              ).run(createId("txn"), p.userId, t.entryFee, w.depositBalance + w.winningBalance + w.bonusBalance, createReferenceId("RFD"),
                "Registration removed — entry fee refunded", JSON.stringify({ tournamentId: t.id, participantId: p.id }), nowIso);
              refunded = t.entryFee;
            }
            db.prepare("DELETE FROM TournamentParticipant WHERE id = ?").run(p.id);
            db.prepare("UPDATE Tournament SET slotsFilled = MAX(0, slotsFilled - 1), updatedAt = ? WHERE id = ?").run(nowIso, t.id);
            db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'ANNOUNCEMENT', ?, ?, ?, ?)`).run(
              createId("notif"), p.userId, "Registration removed",
              refunded ? `Your registration for ${t.title} was removed and the entry fee was refunded.` : `Your registration for ${t.title} was removed by an admin.`,
              JSON.stringify({ tournamentId: t.id }), nowIso
            );
            audit("REGISTRATION_REMOVED", { participantId: p.id, userId: p.userId, refunded });
            return { removed: true, refunded };
          }
        }
      })
      .immediate();

    return ok(result);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
