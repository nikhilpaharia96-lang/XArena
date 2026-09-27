import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    let query = `
      SELECT st.id, st.subject, st.message, st.status, st.priority, st.createdAt, st.updatedAt,
             u.id as userId, u.username, u.email
      FROM SupportTicket st JOIN User u ON u.id = st.userId
    `;
    const params: (string | number)[] = [];
    if (status) {
      query += " WHERE st.status = ?";
      params.push(status);
    }
    query += " ORDER BY CASE st.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, st.createdAt ASC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
