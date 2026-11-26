import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function POST() {
  try {
    const user = await getCurrentUser();
    const result = db.prepare("UPDATE Notification SET isRead = 1 WHERE userId = ? AND isRead = 0").run(user.id);
    return ok({ updated: result.changes });
  } catch (error) {
    return fail(error);
  }
}
