import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const tournament = db.prepare("SELECT id, status FROM Tournament WHERE id = ?").get(id) as
      | { id: string; status: string }
      | undefined;
    if (!tournament) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    if (tournament.status !== "DRAFT") {
      throw new ApiError(400, "Only draft tournaments can be published.", "NOT_DRAFT");
    }

    db.prepare("UPDATE Tournament SET status = 'PUBLISHED', updatedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );

    writeAuditLog({ actorId: user.id, action: "TOURNAMENT_PUBLISHED", targetType: "Tournament", targetId: id });

    return ok({ published: true });
  } catch (error) {
    return fail(error);
  }
}
