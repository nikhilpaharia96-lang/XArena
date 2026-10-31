import { ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { gameService } from "@/server/games/service.instance";
import { failGame } from "@/server/games/http";

export const dynamic = "force-dynamic";

/** Admin overview: per-game config, 24h / all-time results (GGR), recent rounds. */
export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
    return ok({
      configs: gameService.listConfigs(),
      statsAllTime: gameService.stats(),
      stats24h: gameService.stats(since24h),
      recent: gameService.recentRounds(50),
    });
  } catch (error) {
    return failGame(error);
  }
}
