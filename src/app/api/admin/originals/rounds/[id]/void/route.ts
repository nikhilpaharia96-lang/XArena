import { ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { gameService } from "@/server/games/service.instance";
import { failGame } from "@/server/games/http";

/** Refund an OPEN round's stake (e.g. support case). Settled rounds cannot be voided. */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const round = gameService.voidRound(id);
    writeAuditLog({ actorId: admin.id, action: "ORIGINALS_ROUND_VOIDED", targetType: "GameRound", targetId: id });
    return ok(round);
  } catch (error) {
    return failGame(error);
  }
}
