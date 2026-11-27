import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { saveRoom } from "@/server/lib/room-release";
import { releaseRoomSchema } from "@/server/lib/admin-schemas";
import { writeAuditLog } from "@/server/lib/audit";

/**
 * Room credentials are the most time-sensitive data in the whole platform —
 * releasing them fires a notification to every participant simultaneously
 * (in production, this would fan out through FCM push + in-app notification;
 * FCM wiring is TODO pending Firebase credentials — see notification
 * creation below, which is fully real and will be picked up by the push
 * layer once configured).
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;
    const body = await req.json();
    const input = releaseRoomSchema.parse(body);

    const tournament = db.prepare("SELECT id, status FROM Tournament WHERE id = ?").get(id) as
      | { id: string; status: string }
      | undefined;
    if (!tournament) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const now = new Date().toISOString();
    const result = db.transaction(() =>
      saveRoom(db, { tournamentId: id, roomId: input.roomId, roomPassword: input.roomPassword, releaseMinutesBefore: input.releaseMinutesBefore, now })
    )();

    writeAuditLog({ actorId: user.id, action: result.released ? "ROOM_RELEASED" : "ROOM_SCHEDULED", targetType: "Tournament", targetId: id });

    return ok({ released: result.released, releaseAt: result.releaseAt });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
