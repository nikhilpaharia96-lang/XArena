import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "pending"; // pending | disputed | verified
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    let where = "mr.verifiedAt IS NULL AND mr.isDisputed = 0";
    if (filter === "disputed") where = "mr.isDisputed = 1";
    if (filter === "verified") where = "mr.verifiedAt IS NOT NULL";

    const rows = db
      .prepare(
        `SELECT mr.id, mr.placement, mr.kills, mr.screenshotUrl, mr.submittedAt, mr.isDisputed, mr.disputeReason,
                mr.verifiedAt, u.username, u.avatarUrl, t.title as tournamentTitle, t.slug as tournamentSlug
         FROM MatchResult mr
         JOIN User u ON u.id = mr.userId
         JOIN Match m ON m.id = mr.matchId
         JOIN Tournament t ON t.id = m.tournamentId
         WHERE ${where}
         ORDER BY mr.submittedAt ASC LIMIT ?`
      )
      .all(limit) as { isDisputed: number; [k: string]: unknown }[];

    return ok(rows.map((r) => ({ ...r, isDisputed: Boolean(r.isDisputed) })));
  } catch (error) {
    return fail(error);
  }
}
