import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { PROVIDER_ID } from "@/server/providers/astech/astech.config";
import { z } from "zod";

const schema = z.object({ isEnabled: z.boolean() }).strict();

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const { isEnabled } = schema.parse(await req.json());
    const res = db.prepare("UPDATE ProviderGame SET isEnabled = ?, updatedAt = ? WHERE id = ? AND provider = ?").run(isEnabled ? 1 : 0, new Date().toISOString(), id, PROVIDER_ID);
    if (res.changes === 0) throw new ApiError(404, "Game not found.", "NOT_FOUND");
    writeAuditLog({ actorId: admin.id, action: isEnabled ? "ASTECH_GAME_ENABLED" : "ASTECH_GAME_DISABLED", targetType: "ProviderGame", targetId: id });
    return ok({ id, isEnabled });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    return fail(error);
  }
}
