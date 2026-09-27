import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";

const disputeSchema = z.object({ reason: z.string().trim().min(5).max(500) });

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;
    const body = await req.json();
    const input = disputeSchema.parse(body);

    const result = db.prepare("SELECT id FROM MatchResult WHERE id = ?").get(id);
    if (!result) throw new ApiError(404, "Result not found.", "NOT_FOUND");

    db.prepare("UPDATE MatchResult SET isDisputed = 1, disputeReason = ? WHERE id = ?").run(input.reason, id);

    writeAuditLog({
      actorId: admin.id,
      action: "RESULT_DISPUTED",
      targetType: "MatchResult",
      targetId: id,
      metadata: { reason: input.reason },
    });

    return ok({ disputed: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
