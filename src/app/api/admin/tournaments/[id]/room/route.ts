import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
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

    db.transaction(() => {
      db.prepare(
        `UPDATE Tournament SET roomId = ?, roomPassword = ?, roomReleasedAt = ?, status = 'LIVE', updatedAt = ? WHERE id = ?`
      ).run(input.roomId, input.roomPassword, now, now, id);

      const participants = db
        .prepare("SELECT userId FROM TournamentParticipant WHERE tournamentId = ?")
        .all(id) as { userId: string }[];

      // TODO(FCM): also send a push notification via Firebase Cloud
      // Messaging here once FCM_SERVER_KEY / service account is configured
      // (see src/server/lib/push.ts). The in-app Notification row below is
      // fully functional today and will show up in the bell icon regardless.
      for (const p of participants) {
        db.prepare(
          `INSERT INTO Notification (id, userId, type, title, body, data, createdAt)
           VALUES (?, ?, 'ROOM_RELEASED', ?, ?, ?, ?)`
        ).run(
          createId("notif"),
          p.userId,
          "Room ID released! 🔑",
          "Your match room details are now available. Head to the tournament page to join.",
          JSON.stringify({ tournamentId: id }),
          now
        );
      }
    })();

    writeAuditLog({ actorId: user.id, action: "ROOM_RELEASED", targetType: "Tournament", targetId: id });

    return ok({ released: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
