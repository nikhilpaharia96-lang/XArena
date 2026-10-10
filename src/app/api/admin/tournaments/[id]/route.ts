import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { crossFieldIssues, draftTournamentSchema, updateTournamentSchema } from "@/server/lib/admin-schemas";
import { rowToFields, type TournamentRow } from "@/server/lib/tournament-fields";
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

    const existing = db.prepare("SELECT * FROM Tournament WHERE id = ?").get(id) as TournamentRow | undefined;
    if (!existing) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (["LIVE", "COMPLETED", "CANCELLED"].includes(existing.status)) {
      throw new ApiError(400, "Can't edit a tournament that is live, completed or cancelled.", "NOT_EDITABLE");
    }

    const body = await req.json();
    const isDraft = existing.status === "DRAFT";
    // Drafts keep relaxed validation so work-in-progress can be saved; published ones stay strict.
    const input = isDraft ? draftTournamentSchema.partial().parse(body) : updateTournamentSchema.parse(body);

    // Cross-field rules are checked against the merged result, never the patch alone.
    const merged = { ...rowToFields(existing), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
    const issue = crossFieldIssues(merged as Parameters<typeof crossFieldIssues>[0], { draft: isDraft })[0];
    if (issue) throw new ApiError(400, issue.message, "VALIDATION_ERROR");

    // Money/capacity changes are blocked once players have paid in.
    if (existing.slotsFilled > 0) {
      const f = rowToFields(existing);
      if ((input.entryFeeRupees !== undefined && input.entryFeeRupees !== f.entryFeeRupees) || (input.format !== undefined && input.format !== f.format)) {
        throw new ApiError(400, "Entry fee and format can't change after players have joined.", "HAS_PARTICIPANTS");
      }
      if (input.maxSlots !== undefined && input.maxSlots < existing.slotsFilled) {
        throw new ApiError(400, `Max slots can't be lower than the ${existing.slotsFilled} players already joined.`, "HAS_PARTICIPANTS");
      }
    }

    const columnMap: Record<string, unknown> = {};
    if (input.title !== undefined) columnMap.title = input.title;
    if (input.description !== undefined) columnMap.description = input.description;
    if (input.bannerUrl !== undefined) columnMap.bannerUrl = input.bannerUrl;
    if (input.thumbnailUrl !== undefined) columnMap.thumbnailUrl = input.thumbnailUrl;
    if (input.gameId !== undefined) {
      if (!db.prepare("SELECT id FROM Game WHERE id = ?").get(input.gameId)) throw new ApiError(404, "Game not found.", "GAME_NOT_FOUND");
      columnMap.gameId = input.gameId;
    }
    if (input.mode !== undefined) columnMap.mode = input.mode;
    if (input.format !== undefined) columnMap.format = input.format;
    if (input.cadence !== undefined) columnMap.cadence = input.cadence;
    if (input.entryFeeRupees !== undefined) columnMap.entryFee = rupeesToPaise(input.entryFeeRupees);
    if (input.prizePoolRupees !== undefined) columnMap.prizePool = rupeesToPaise(input.prizePoolRupees);
    if (input.prizeDistribution !== undefined) {
      columnMap.prizeDistribution = JSON.stringify(
        (input.prizeDistribution as { position: number; amountRupees: number }[]).map((p) => ({
          position: p.position,
          amount: rupeesToPaise(p.amountRupees),
        }))
      );
    }
    if (input.maxSlots !== undefined) columnMap.maxSlots = input.maxSlots;
    if (input.roomSize !== undefined) columnMap.roomSize = input.roomSize;
    if (input.map !== undefined) columnMap.map = input.map || null;
    if (input.category !== undefined) columnMap.category = input.category;
    if (input.rules !== undefined) columnMap.rules = input.rules;
    if (input.scoringSystem !== undefined) columnMap.scoringSystem = input.scoringSystem;
    if (input.registrationStartsAt !== undefined) columnMap.registrationStartsAt = input.registrationStartsAt;
    if (input.registrationEndsAt !== undefined) columnMap.registrationEndsAt = input.registrationEndsAt;
    if (input.matchStartsAt !== undefined) columnMap.matchStartsAt = input.matchStartsAt;
    if (input.matchEndsAt !== undefined) columnMap.matchEndsAt = input.matchEndsAt;
    if (input.adminNotes !== undefined) columnMap.adminNotes = input.adminNotes;
    if (input.isFeatured !== undefined) columnMap.isFeatured = input.isFeatured ? 1 : 0;
    if (input.slotSelection !== undefined) columnMap.slotSelection = input.slotSelection ? 1 : 0;

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
    return fail(validationError(error) ?? error);
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
