import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";

/**
 * GET /api/leaderboard?type=winners|players|referrers&period=daily|weekly|monthly|all
 *
 * "players" ranks by win count, "winners" ranks by total prize earnings,
 * "referrers" ranks by number of successful referrals. Period filtering on
 * players/winners uses MatchResult.submittedAt / Transaction.createdAt
 * windows rather than the all-time PlayerStats aggregate, since the
 * aggregate has no time dimension — see the SQL for how each period maps
 * to a date boundary.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "winners";
    const period = url.searchParams.get("period") ?? "all";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    const since = periodToSince(period);

    if (type === "referrers") {
      const query = `
        SELECT u.id, u.username, u.avatarUrl, COUNT(r.id) as referralCount,
               COALESCE(SUM(r.bonusAmount), 0) as totalEarned
        FROM User u
        JOIN Referral r ON r.referrerId = u.id
        ${since ? "WHERE r.createdAt >= ?" : ""}
        GROUP BY u.id
        ORDER BY referralCount DESC
        LIMIT ?
      `;
      const rows = since ? db.prepare(query).all(since, limit) : db.prepare(query).all(limit);
      return ok(rows.map((r, i) => ({ ...(r as object), rank: i + 1 })));
    }

    if (type === "players") {
      const query = `
        SELECT u.id, u.username, u.avatarUrl, ps.matchesPlayed, ps.wins, ps.kills,
               CASE WHEN ps.matchesPlayed > 0 THEN CAST(ps.wins AS REAL) / ps.matchesPlayed ELSE 0 END as winRate
        FROM User u JOIN PlayerStats ps ON ps.userId = u.id
        WHERE ps.matchesPlayed > 0
        ORDER BY ps.wins DESC, winRate DESC
        LIMIT ?
      `;
      const rows = db.prepare(query).all(limit);
      return ok(rows.map((r, i) => ({ ...(r as object), rank: i + 1 })));
    }

    // default: winners, ranked by total prize earnings (TOURNAMENT_PRIZE transactions)
    const query = `
      SELECT u.id, u.username, u.avatarUrl, COALESCE(SUM(t.amount), 0) as totalWinnings, COUNT(t.id) as prizesWon
      FROM User u
      JOIN "Transaction" t ON t.userId = u.id AND t.type = 'TOURNAMENT_PRIZE' AND t.status = 'COMPLETED'
      ${since ? "AND t.createdAt >= ?" : ""}
      GROUP BY u.id
      HAVING totalWinnings > 0
      ORDER BY totalWinnings DESC
      LIMIT ?
    `;
    const rows = since ? db.prepare(query).all(since, limit) : db.prepare(query).all(limit);
    return ok(rows.map((r, i) => ({ ...(r as object), rank: i + 1 })));
  } catch (error) {
    return fail(error);
  }
}

function periodToSince(period: string): string | null {
  const now = new Date();
  switch (period) {
    case "daily":
      now.setHours(0, 0, 0, 0);
      return now.toISOString();
    case "weekly":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "monthly":
      now.setMonth(now.getMonth() - 1);
      return now.toISOString();
    default:
      return null;
  }
}
