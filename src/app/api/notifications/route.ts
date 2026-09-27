import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "1";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);

    let query = `SELECT id, type, title, body, data, isRead, createdAt FROM Notification WHERE userId = ?`;
    const params: (string | number)[] = [user.id];
    if (unreadOnly) query += " AND isRead = 0";
    query += " ORDER BY createdAt DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params) as { isRead: number; [k: string]: unknown }[];
    const notifications = rows.map((n) => ({ ...n, isRead: Boolean(n.isRead) }));

    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM Notification WHERE userId = ? AND isRead = 0")
      .get(user.id) as { count: number };

    return ok({ notifications, unreadCount: count });
  } catch (error) {
    return fail(error);
  }
}
