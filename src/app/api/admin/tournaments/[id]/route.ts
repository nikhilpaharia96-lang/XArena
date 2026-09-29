import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { updateTournamentSchema } from "@/server/lib/admin-schemas";
import { rupeesToPaise } from "@/server/lib/money";
import { writeAuditLog } from "@/server/lib/audit";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;

    const tournament = db.prepare("SELECT * FROM Tournament WHERE id = ?").get(id);
    if (!tournament) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const participants = db
      .prepare(
        `SELECT tp.*, u.username, u.email FROM TournamentParticipant tp JOIN User u ON u.id = tp.userId
         WHERE tp.tournamentId = ? ORDER BY tp.joinedAt ASC`
      )
      .all(id);

    return ok({ ...(tournament as object), participants });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const existing = db.prepare("SELECT id, status FROM Tournament WHERE id = ?").get(id) as
      | { id: string; status: string }
      | undefined;
    if (!existing) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (["LIVE", "COMPLETED"].includes(existing.status)) {
      throw new ApiError(400, "Can't edit a tournament that is live or completed.", "NOT_EDITABLE");
    }

    const body = await req.json();
    const input = updateTournamentSchema.parse(body);

    const columnMap: Record<string, unknown> = {};
    if (input.title !== undefined) columnMap.title = input.title;
    if (input.description !== undefined) columnMap.description = input.description;
    if (input.bannerUrl !== undefined) columnMap.bannerUrl = input.bannerUrl;
    if (input.mode !== undefined) columnMap.mode = input.mode;
    if (input.format !== undefined) columnMap.format = input.format;
    if (input.cadence !== undefined) columnMap.cadence = input.cadence;
    if (input.entryFeeRupees !== undefined) columnMap.entryFee = rupeesToPaise(input.entryFeeRupees);
    if (input.prizePoolRupees !== undefined) columnMap.prizePool = rupeesToPaise(input.prizePoolRupees);
    if (input.prizeDistribution !== undefined) {
      columnMap.prizeDistribution = JSON.stringify(
        input.prizeDistribution.map((p) => ({ position: p.position, amount: rupeesToPaise(p.amountRupees) }))
      );
    }
    if (input.maxSlots !== undefined) columnMap.maxSlots = input.maxSlots;
    if (input.roomSize !== undefined) columnMap.roomSize = input.roomSize;
    if (input.map !== undefined) columnMap.map = input.map;
    if (input.category !== undefined) columnMap.category = input.category;
    if (input.rules !== undefined) columnMap.rules = input.rules;
    if (input.scoringSystem !== undefined) columnMap.scoringSystem = input.scoringSystem;
    if (input.registrationStartsAt !== undefined) columnMap.registrationStartsAt = input.registrationStartsAt;
    if (input.registrationEndsAt !== undefined) columnMap.registrationEndsAt = input.registrationEndsAt;
    if (input.matchStartsAt !== undefined) columnMap.matchStartsAt = input.matchStartsAt;
    if (input.adminNotes !== undefined) columnMap.adminNotes = input.adminNotes;
    if (input.isFeatured !== undefined) columnMap.isFeatured = input.isFeatured ? 1 : 0;

    if (Object.keys(columnMap).length === 0) {
      throw new ApiError(400, "No fields to update.", "NO_FIELDS");
    }

    columnMap.updatedAt = new Date().toISOString();
    const setClause = Object.keys(columnMap)
      .map((k) => `${k} = ?`)
      .join(", ");
    db.prepare(`UPDATE Tournament SET ${setClause} WHERE id = ?`).run(...Object.values(columnMap), id);

    writeAuditLog({
      actorId: user.id,
      action: "TOURNAMENT_UPDATED",
      targetType: "Tournament",
      targetId: id,
      metadata: { fields: Object.keys(columnMap) },
    });

    return ok({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const existing = db.prepare("SELECT id, status, slotsFilled FROM Tournament WHERE id = ?").get(id) as
      | { id: string; status: string; slotsFilled: number }
      | undefined;
    if (!existing) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (existing.slotsFilled > 0) {
      throw new ApiError(
        400,
        "Can't delete a tournament with joined participants. Cancel it instead to trigger refunds.",
        "HAS_PARTICIPANTS"
      );
    }

    db.prepare("DELETE FROM Tournament WHERE id = ?").run(id);
    writeAuditLog({ actorId: user.id, action: "TOURNAMENT_DELETED", targetType: "Tournament", targetId: id });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
