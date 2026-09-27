import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const target = db.prepare("SELECT id FROM User WHERE id = ?").get(id);
    if (!target) throw new ApiError(404, "User not found.", "NOT_FOUND");

    db.prepare("UPDATE User SET status = 'ACTIVE', updatedAt = ? WHERE id = ?").run(new Date().toISOString(), id);
    writeAuditLog({ actorId: admin.id, action: "USER_REACTIVATED", targetType: "User", targetId: id });

    return ok({ reactivated: true });
  } catch (error) {
    return fail(error);
  }
}
