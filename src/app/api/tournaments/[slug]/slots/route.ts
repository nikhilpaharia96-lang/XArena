import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/server/lib/auth";
import { buildBoard, getTournamentForSlots, registrationBlock } from "@/server/lib/slots";
import { slotLabel, positionLabel } from "@/lib/slot-layout";

/**
 * Live slot board for the registration screen. Public (so logged-out visitors can look), but
 * player details of other users are limited to their public username.
 */
export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const t = getTournamentForSlots({ slug });
    const hidden = t ? (db.prepare("SELECT status FROM Tournament WHERE id = ?").get(t.id) as { status: string } | undefined) : undefined;
    if (!t || hidden?.status === "DRAFT") throw new ApiError(404, "Tournament not found.", "NOT_FOUND");

    let viewerId: string | null = null;
    const token = (await cookies()).get(ACCESS_COOKIE_NAME)?.value;
    if (token) viewerId = verifyAccessToken(token)?.sub ?? null;

    const mine = viewerId
      ? (db
          .prepare("SELECT slotNumber, position FROM TournamentParticipant WHERE tournamentId = ? AND userId = ?")
          .get(t.id, viewerId) as { slotNumber: number | null; position: number | null } | undefined)
      : undefined;

    const block = registrationBlock(t);
    const board = buildBoard(t, { viewerId, admin: false, accepting: !block && !mine });

    // Pre-fill from the player's most recent registration for the same game (no duplicate profile table).
    let profile: { ign: string | null; gameUid: string | null } = { ign: null, gameUid: null };
    if (viewerId) {
      const prev = db
        .prepare(
          `SELECT tp.ign, tp.gameUid FROM TournamentParticipant tp
           JOIN Tournament tt ON tt.id = tp.tournamentId
           WHERE tp.userId = ? AND tp.gameUid IS NOT NULL
             AND tt.gameId = (SELECT gameId FROM Tournament WHERE id = ?)
           ORDER BY tp.joinedAt DESC LIMIT 1`
        )
        .get(viewerId, t.id) as { ign: string | null; gameUid: string | null } | undefined;
      if (prev) profile = prev;
      else {
        const u = db.prepare("SELECT username FROM User WHERE id = ?").get(viewerId) as { username: string } | undefined;
        profile = { ign: u?.username ?? null, gameUid: null };
      }
    }

    return ok({
      tournamentId: t.id,
      slotSelection: Boolean(t.slotSelection),
      ...board,
      registration: {
        open: !block && !mine,
        blockCode: mine ? "ALREADY_JOINED" : (block?.code ?? null),
        blockMessage: mine ? "You've already registered for this tournament." : (block?.message ?? null),
        mySlot: mine?.slotNumber
          ? {
              slotNumber: mine.slotNumber,
              position: mine.position,
              slotLabel: slotLabel(board.layout, mine.slotNumber),
              positionLabel: mine.position ? positionLabel(mine.position) : null,
            }
          : null,
      },
      profile,
    });
  } catch (error) {
    return fail(error);
  }
}
