import { z } from "zod";
import { ApiError, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { gameService } from "@/server/games/service.instance";
import { failGame } from "@/server/games/http";
import { GAME_KEYS, type GameKey } from "@/server/games/math";

const schema = z
  .object({
    isEnabled: z.boolean().optional(),
    houseEdgeBps: z.number().int().optional(),
    minBet: z.number().int().optional(),
    maxBet: z.number().int().optional(),
    maxPayout: z.number().int().optional(),
  })
  .strict();

export async function PATCH(req: Request, context: { params: Promise<{ game: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { game } = await context.params;
    const key = game.toUpperCase() as GameKey;
    if (!GAME_KEYS.includes(key)) throw new ApiError(404, "Game not found.", "NOT_FOUND");
    const patch = schema.parse(await req.json());
    const before = gameService.getConfig(key);
    const after = gameService.updateConfig(key, patch);
    writeAuditLog({
      actorId: admin.id,
      action: "ORIGINALS_CONFIG_UPDATED",
      targetType: "GameConfig",
      targetId: key,
      metadata: { before, after },
    });
    return ok(after);
  } catch (error) {
    return failGame(error);
  }
}
