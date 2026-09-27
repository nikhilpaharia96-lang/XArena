import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { banUserSchema } from "@/server/lib/admin-schemas";
import { writeAuditLog } from "@/server/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const body = await req.json();
    const input = banUserSchema.parse(body);

    const target = db.prepare("SELECT id, role FROM User WHERE id = ?").get(id) as
      | { id: string; role: string }
      | undefined;
    if (!target) throw new ApiError(404, "User not found.", "NOT_FOUND");
    if (["ADMIN", "SUPER_ADMIN"].includes(target.role) && admin.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Only a super admin can ban an admin account.", "FORBIDDEN");
    }

    db.prepare("UPDATE User SET status = 'BANNED', updatedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );

    // Revoke all active sessions so the ban takes effect immediately, not
    // just on next token expiry (access tokens are short-lived at 15 min,
    // but this closes the gap for refresh too).
    db.prepare("UPDATE Session SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run(
      new Date().toISOString(),
      id
    );

    writeAuditLog({
      actorId: admin.id,
      action: "USER_BANNED",
      targetType: "User",
      targetId: id,
      metadata: { reason: input.reason },
    });

    return ok({ banned: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
