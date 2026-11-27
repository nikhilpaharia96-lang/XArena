import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { settleTournament } from "@/server/lib/match-settlement";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;
    const t = db.prepare("SELECT id, title, status, roomSize, prizeDistribution FROM Tournament WHERE id = ?").get(id) as
      | { id: string; title: string; status: string; roomSize: number; prizeDistribution: string } | undefined;
    if (!t) throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    const roster = db
      .prepare(
        `SELECT tp.id AS participantId, u.username, tp.ign, tp.gameUid, tp.teamName, tp.slotNumber
         FROM TournamentParticipant tp JOIN User u ON u.id = tp.userId
         WHERE tp.tournamentId = ? AND tp.status != 'CANCELLED' ORDER BY tp.slotNumber IS NULL, tp.slotNumber, tp.position, tp.joinedAt`
      )
      .all(id);
    return ok({
      tournament: { id: t.id, title: t.title, status: t.status, roomSize: t.roomSize },
      prizes: (JSON.parse(t.prizeDistribution) as { position: number; amount: number }[]).sort((a, b) => a.position - b.position),
      roster,
    });
  } catch (error) {
    return fail(error);
  }
}

const bodySchema = z.object({
  killRewardRupees: z.number().min(0).max(100000).default(0),
  rows: z.array(z.object({ participantId: z.string().min(1), placement: z.number().int().min(1).max(200), kills: z.number().int().min(0).max(200) })).min(1).max(500),
});

const MESSAGES: Record<string, [number, string]> = {
  ALREADY_COMPLETED: [409, "Results for this tournament are already settled."],
  NOT_SETTLEABLE: [400, "This tournament cannot be settled (draft or cancelled)."],
  UNKNOWN_PARTICIPANT: [400, "A row refers to a player who is not in this tournament."],
  DUPLICATE_PARTICIPANT: [400, "A player appears more than once."],
  NO_ROWS: [400, "Add at least one result."],
};

/** Records placement + kills for everyone, pays the prizes and completes the tournament in one step. */
export async function POST(req: Request, context: Ctx) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const input = bodySchema.parse(await req.json());

    let outcome;
    try {
      outcome = settleTournament(db, {
        tournamentId: id,
        adminId: admin.id,
        rows: input.rows,
        killRewardPaise: Math.round(input.killRewardRupees * 100),
        now: new Date().toISOString(),
      });
    } catch (e) {
      const m = MESSAGES[(e as Error).message];
      if (m) throw new ApiError(m[0], m[1], (e as Error).message);
      throw e;
    }

    writeAuditLog({ actorId: admin.id, action: "RESULTS_SETTLED", targetType: "Tournament", targetId: id, metadata: { players: outcome.rows.length, paidPaise: outcome.paidPaise } });
    return ok({ settled: true, players: outcome.rows.length, winners: outcome.winners, paidPaise: outcome.paidPaise });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    return fail(error);
  }
}
