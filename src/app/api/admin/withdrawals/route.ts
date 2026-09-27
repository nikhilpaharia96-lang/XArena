import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "PENDING";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const rows = db
      .prepare(
        `SELECT wr.id, wr.amount, wr.status, wr.upiId, wr.createdAt, wr.reviewedAt, wr.rejectionReason,
                u.id as userId, u.username, u.email
         FROM WithdrawRequest wr JOIN User u ON u.id = wr.userId
         WHERE wr.status = ?
         ORDER BY wr.createdAt ASC LIMIT ?`
      )
      .all(status, limit);

    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
