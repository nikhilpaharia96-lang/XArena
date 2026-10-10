import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { createTournamentSchema } from "@/server/lib/admin-schemas";
import { rowToFields, type TournamentRow } from "@/server/lib/tournament-fields";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const tournament = db.prepare("SELECT * FROM Tournament WHERE id = ?").get(id) as TournamentRow | undefined;
    if (!tournament) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (tournament.status !== "DRAFT") {
      throw new ApiError(400, "Only draft tournaments can be published.", "NOT_DRAFT");
    }

    // Completeness gate: the stored draft must satisfy the full create schema before going public.
    const parsed = createTournamentSchema.safeParse(rowToFields(tournament));
    if (!parsed.success) {
      const problems = parsed.error.issues.slice(0, 3).map((i) => i.message);
      throw new ApiError(400, `Can't publish yet: ${problems.join("; ")}.`, "INCOMPLETE");
    }
    if (new Date(parsed.data.matchStartsAt).getTime() <= Date.now()) {
      throw new ApiError(400, "Can't publish: the match start time is in the past.", "SCHEDULE_IN_PAST");
    }
    if (new Date(parsed.data.registrationEndsAt).getTime() <= Date.now()) {
      throw new ApiError(400, "Can't publish: registration has already closed.", "SCHEDULE_IN_PAST");
    }

    db.prepare("UPDATE Tournament SET status = 'PUBLISHED', updatedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );

    writeAuditLog({ actorId: user.id, action: "TOURNAMENT_PUBLISHED", targetType: "Tournament", targetId: id });

    return ok({ published: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
