import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { createTournamentSchema, crossFieldIssues, draftTournamentSchema } from "@/server/lib/admin-schemas";
import { rupeesToPaise } from "@/server/lib/money";
import { writeAuditLog } from "@/server/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    let query = `
      SELECT t.id, t.slug, t.title, t.status, t.format, t.mode, t.entryFee, t.prizePool,
             t.maxSlots, t.slotsFilled, t.category, t.isFeatured, t.bannerUrl, t.thumbnailUrl, t.matchStartsAt, t.registrationEndsAt, t.createdAt, g.name as gameName
      FROM Tournament t JOIN Game g ON g.id = t.gameId
    `;
    const params: (string | number)[] = [];
    if (status) {
      query += " WHERE t.status = ?";
      params.push(status);
    }
    query += " ORDER BY t.createdAt DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");

    const body = await req.json();
    const isDraft = body?.saveAsDraft === true;

    // Drafts only need title + slug + game; the publish route enforces completeness.
    const input = isDraft ? draftTournamentSchema.parse(body) : createTournamentSchema.parse(body);
    if (isDraft) {
      const issue = crossFieldIssues(input, { draft: true })[0];
      if (issue) throw new ApiError(400, issue.message, "VALIDATION_ERROR");
    }

    const existingSlug = db.prepare("SELECT id FROM Tournament WHERE slug = ?").get(input.slug);
    if (existingSlug) {
      throw new ApiError(409, "A tournament with this slug already exists.", "SLUG_TAKEN");
    }

    const game = db.prepare("SELECT id FROM Game WHERE id = ?").get(input.gameId);
    if (!game) {
      throw new ApiError(404, "Game not found.", "GAME_NOT_FOUND");
    }

    const id = createId("tourn");
    const now = new Date().toISOString();
    const dist = (input.prizeDistribution ?? []) as { position: number; amountRupees: number }[];

    db.prepare(
      `INSERT INTO Tournament (
        id, slug, title, description, bannerUrl, thumbnailUrl, gameId, mode, format, cadence, status, entryFee, prizePool, prizeDistribution, maxSlots, slotsFilled, roomSize, map, category, rules, scoringSystem, registrationStartsAt, registrationEndsAt, matchStartsAt, matchEndsAt, adminNotes, isFeatured, slotSelection, createdById, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.slug,
      input.title,
      input.description ?? "",
      input.bannerUrl ?? null,
      input.thumbnailUrl ?? null,
      input.gameId,
      input.mode ?? "SOLO",
      input.format ?? "FREE",
      input.cadence ?? "ONE_OFF",
      rupeesToPaise(input.entryFeeRupees ?? 0),
      rupeesToPaise(input.prizePoolRupees ?? 0),
      JSON.stringify(dist.map((p) => ({ position: p.position, amount: rupeesToPaise(p.amountRupees) }))),
      input.maxSlots ?? 2,
      input.roomSize ?? 1,
      input.map || null,
      input.category ?? null,
      input.rules ?? "",
      input.scoringSystem ?? null,
      input.registrationStartsAt ?? "",
      input.registrationEndsAt ?? "",
      input.matchStartsAt ?? "",
      input.matchEndsAt ?? null,
      input.adminNotes ?? null,
      input.isFeatured ? 1 : 0,
      input.slotSelection === false ? 0 : 1,
      user.id,
      now,
      now
    );

    writeAuditLog({
      actorId: user.id,
      action: "TOURNAMENT_CREATED",
      targetType: "Tournament",
      targetId: id,
      metadata: { draft: isDraft },
    });

    return ok({ id, slug: input.slug, status: "DRAFT" }, 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
