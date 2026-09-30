import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { FREE_FIRE_CATEGORIES } from "@/lib/free-fire-categories";

/**
 * GET /api/games/free-fire-max/categories
 *
 * Real aggregates per category, computed from Tournament rows: "active"
 * means currently joinable or running (REGISTRATION_OPEN / LIVE);
 * "upcoming" is the REGISTRATION_OPEN subset. Players
 * is the sum of slotsFilled, same method as the homepage stats.
 */
export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const game = db.prepare("SELECT id, slug, name FROM Game WHERE slug = ? AND isActive = 1").get(slug) as
      | { id: string; slug: string; name: string }
      | undefined;
    if (!game) throw new ApiError(404, "Game not found.", "NOT_FOUND");

    const rows = db
      .prepare(
        `SELECT category, COUNT(*) AS activeCount, COALESCE(SUM(prizePool), 0) AS prizePool, COALESCE(SUM(slotsFilled), 0) AS players,
                SUM(CASE WHEN status = 'REGISTRATION_OPEN' THEN 1 ELSE 0 END) AS upcomingCount
         FROM Tournament
         WHERE gameId = ? AND status IN ('REGISTRATION_OPEN', 'LIVE')
         GROUP BY category`
      )
      .all(game.id) as { category: string | null; activeCount: number; prizePool: number; players: number; upcomingCount: number }[];

    const byCategory = new Map(rows.map((r) => [r.category, r]));
    const categories = FREE_FIRE_CATEGORIES.map((c) => {
      const r = byCategory.get(c.value);
      return { value: c.value, activeCount: r?.activeCount ?? 0, prizePool: r?.prizePool ?? 0, players: r?.players ?? 0, upcomingCount: r?.upcomingCount ?? 0 };
    });

    return ok({
      game,
      totals: {
        activeCount: rows.reduce((n, r) => n + r.activeCount, 0),
        prizePool: rows.reduce((n, r) => n + r.prizePool, 0),
        players: rows.reduce((n, r) => n + r.players, 0),
      },
      categories,
    });
  } catch (error) {
    return fail(error);
  }
}
