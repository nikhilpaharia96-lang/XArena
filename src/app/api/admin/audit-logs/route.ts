import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const actorId = url.searchParams.get("actorId");
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? 50), 200);
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT al.id, al.action, al.targetType, al.targetId, al.metadata, al.ipAddress, al.createdAt,
             u.username as actorUsername, u.email as actorEmail
      FROM AuditLog al LEFT JOIN User u ON u.id = al.actorId WHERE 1=1
    `;
    const params: (string | number)[] = [];
    if (action) {
      query += " AND al.action = ?";
      params.push(action);
    }
    if (actorId) {
      query += " AND al.actorId = ?";
      params.push(actorId);
    }
    query += " ORDER BY al.createdAt DESC LIMIT ? OFFSET ?";
    params.push(pageSize, offset);

    const rows = db.prepare(query).all(...params);
    const { count } = db.prepare("SELECT COUNT(*) as count FROM AuditLog").get() as { count: number };

    return ok({ logs: rows, pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) } });
  } catch (error) {
    return fail(error);
  }
}
