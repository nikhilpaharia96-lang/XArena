import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;

    const notif = db.prepare("SELECT id FROM Notification WHERE id = ? AND userId = ?").get(id, user.id);
    if (!notif) {
      throw new ApiError(404, "Notification not found.", "NOT_FOUND");
    }

    db.prepare("UPDATE Notification SET isRead = 1 WHERE id = ?").run(id);
    return ok({ read: true });
  } catch (error) {
    return fail(error);
  }
}
