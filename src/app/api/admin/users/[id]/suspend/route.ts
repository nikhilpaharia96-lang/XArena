import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { banUserSchema } from "@/server/lib/admin-schemas";
import { writeAuditLog } from "@/server/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;
    const body = await req.json();
    const input = banUserSchema.parse(body);

    const target = db.prepare("SELECT id FROM User WHERE id = ?").get(id);
    if (!target) throw new ApiError(404, "User not found.", "NOT_FOUND");

    db.prepare("UPDATE User SET status = 'SUSPENDED', updatedAt = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );

    writeAuditLog({
      actorId: admin.id,
      action: "USER_SUSPENDED",
      targetType: "User",
      targetId: id,
      metadata: { reason: input.reason },
    });

    return ok({ suspended: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
