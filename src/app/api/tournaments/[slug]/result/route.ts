import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { z } from "zod";

const resultInputSchema = z.object({
  placement: z.number().int().min(1).max(100).optional(),
  kills: z.number().int().min(0).max(60),
  screenshotUrl: z.string().url().optional(),
});

interface TournamentRow {
  id: string;
  status: string;
  matchStartsAt: string;
}

/**
 * Players self-report placement/kills with a required screenshot as proof.
 * This creates a MatchResult in RESULT_SUBMITTED-equivalent state (isDisputed
 * false, verifiedAt null) — an admin (or, later, an automated anti-cheat
 * pass) must verify it before prize payout. See admin result-verification
 * endpoint. Screenshot upload itself needs Firebase Storage (TODO below);
 * for now the client uploads to a data URL / placeholder host and passes
 * the resulting URL here — the validation and DB write are fully real.
 */
export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    const { slug } = await context.params;
    const body = await req.json();
    const input = resultInputSchema.parse(body);

    const tournament = db
      .prepare("SELECT id, status, matchStartsAt FROM Tournament WHERE slug = ?")
      .get(slug) as TournamentRow | undefined;
    if (!tournament) {
      throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    }

    const participant = db
      .prepare("SELECT id FROM TournamentParticipant WHERE tournamentId = ? AND userId = ?")
      .get(tournament.id, user.id);
    if (!participant) {
      throw new ApiError(403, "You haven't joined this tournament.", "NOT_PARTICIPANT");
    }

    if (new Date() < new Date(tournament.matchStartsAt)) {
      throw new ApiError(400, "You can't submit a result before the match has started.", "TOO_EARLY");
    }

    // TODO(FIREBASE_STORAGE): screenshotUrl is currently expected to be a
    // pre-uploaded URL (e.g. from an external host during dev). Once
    // Firebase Storage credentials are provided, replace the client upload
    // step with a signed upload to Firebase Storage and validate the
    // resulting URL's bucket/path here before accepting it.
    if (!input.screenshotUrl) {
      throw new ApiError(400, "A result screenshot is required.", "SCREENSHOT_REQUIRED");
    }

    const now = new Date().toISOString();

    const result = db.transaction(() => {
      let match = db
        .prepare("SELECT id FROM Match WHERE tournamentId = ? AND round = 1")
        .get(tournament.id) as { id: string } | undefined;

      if (!match) {
        const matchId = createId("match");
        db.prepare(
          `INSERT INTO Match (id, tournamentId, round, status, createdAt, updatedAt)
           VALUES (?, ?, 1, 'RESULT_PENDING', ?, ?)`
        ).run(matchId, tournament.id, now, now);
        match = { id: matchId };
      }

      const existingResult = db
        .prepare("SELECT id FROM MatchResult WHERE matchId = ? AND userId = ?")
        .get(match.id, user.id);
      if (existingResult) {
        throw new ApiError(409, "You've already submitted a result for this match.", "RESULT_ALREADY_SUBMITTED");
      }

      const resultId = createId("res");
      db.prepare(
        `INSERT INTO MatchResult (id, matchId, userId, placement, kills, screenshotUrl, submittedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(resultId, match.id, user.id, input.placement ?? null, input.kills, input.screenshotUrl, now);

      db.prepare(`UPDATE Match SET status = 'RESULT_SUBMITTED', updatedAt = ? WHERE id = ?`).run(now, match.id);

      return resultId;
    })();

    return ok({ submitted: true, resultId: result }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
