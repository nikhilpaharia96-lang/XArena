import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const source = db.prepare("SELECT * FROM Tournament WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!source) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const newId = createId("tourn");
    const now = new Date().toISOString();
    const newSlug = `${source.slug}-copy-${Date.now().toString(36)}`;

    db.prepare(
      `INSERT INTO Tournament (
        id, slug, title, description, bannerUrl, thumbnailUrl, gameId, mode, format, cadence, status,
        entryFee, prizePool, prizeDistribution, maxSlots, slotsFilled, roomSize, map, category, rules,
        scoringSystem, slotSelection, registrationStartsAt, registrationEndsAt, matchStartsAt, matchEndsAt, adminNotes,
        isFeatured, createdById, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newId,
      newSlug,
      `${source.title} (Copy)`,
      source.description,
      source.bannerUrl,
      source.thumbnailUrl ?? null,
      source.gameId,
      source.mode,
      source.format,
      source.cadence,
      source.entryFee,
      source.prizePool,
      source.prizeDistribution,
      source.maxSlots,
      source.roomSize,
      source.map,
      source.category ?? null,
      source.rules,
      source.scoringSystem,
      source.slotSelection ?? 1,
      source.registrationStartsAt,
      source.registrationEndsAt,
      source.matchStartsAt,
      source.matchEndsAt ?? null,
      source.adminNotes,
      0,
      user.id,
      now,
      now
    );

    writeAuditLog({ actorId: user.id, action: "TOURNAMENT_CLONED", targetType: "Tournament", targetId: newId, metadata: { sourceId: id } });

    return ok({ id: newId, slug: newSlug }, 201);
  } catch (error) {
    return fail(error);
  }
}
