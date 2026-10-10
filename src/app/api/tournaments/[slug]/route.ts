import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { verifyAccessToken, ACCESS_COOKIE_NAME } from "@/server/lib/auth";
import { cookies } from "next/headers";
import { buildLayout, positionLabel, slotLabel } from "@/lib/slot-layout";

interface TournamentDetailRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  bannerUrl: string | null;
  gameId: string;
  gameName: string;
  gameSlug: string;
  gameIcon: string | null;
  mode: string;
  format: string;
  cadence: string;
  status: string;
  entryFee: number;
  prizePool: number;
  prizeDistribution: string;
  maxSlots: number;
  slotsFilled: number;
  roomSize: number;
  map: string | null;
  rules: string;
  scoringSystem: string | null;
  registrationStartsAt: string;
  registrationEndsAt: string;
  matchStartsAt: string;
  roomId: string | null;
  roomPassword: string | null;
  roomReleasedAt: string | null;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;

    const t = db
      .prepare(
        `SELECT t.id, t.slug, t.title, t.description, t.bannerUrl, t.gameId, g.name as gameName, g.slug as gameSlug,
                g.iconUrl as gameIcon, t.mode, t.format, t.cadence, t.status, t.entryFee, t.prizePool,
                t.prizeDistribution, t.maxSlots, t.slotsFilled, t.roomSize, t.map, t.rules, t.scoringSystem,
                t.registrationStartsAt, t.registrationEndsAt, t.matchStartsAt, t.roomId, t.roomPassword, t.roomReleasedAt
         FROM Tournament t JOIN Game g ON g.id = t.gameId
         WHERE t.slug = ? AND t.status != 'DRAFT'`
      )
      .get(slug) as TournamentDetailRow | undefined;

    if (!t) {
      throw new ApiError(404, "Tournament not found.", "NOT_FOUND");
    }

    // Determine viewer join status (if authenticated) — room credentials are
    // only ever returned to participants, and only once released by an admin.
    let isJoined = false;
    let mySlot: { slotNumber: number; position: number; slotLabel: string; positionLabel: string; teamSize: number } | null = null;
    let userId: string | null = null;
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        userId = payload.sub;
        const p = db
          .prepare("SELECT id, slotNumber, position FROM TournamentParticipant WHERE tournamentId = ? AND userId = ?")
          .get(t.id, payload.sub) as { id: string; slotNumber: number | null; position: number | null } | undefined;
        isJoined = Boolean(p);
        if (p?.slotNumber && p.position) {
          const layout = buildLayout(t.mode, t.roomSize, t.maxSlots);
          mySlot = {
            slotNumber: p.slotNumber,
            position: p.position,
            slotLabel: slotLabel(layout, p.slotNumber),
            positionLabel: positionLabel(p.position),
            teamSize: layout.teamSize,
          };
        }
      }
    }

    const participants = db
      .prepare(
        `SELECT tp.id, tp.teamName, tp.status, tp.joinedAt, u.username, u.avatarUrl
         FROM TournamentParticipant tp JOIN User u ON u.id = tp.userId
         WHERE tp.tournamentId = ? ORDER BY tp.joinedAt ASC`
      )
      .all(t.id);

    const roomReleased = Boolean(t.roomReleasedAt) && t.roomId;
    const canSeeRoom = isJoined && roomReleased;

    return ok({
      ...t,
      prizeDistribution: JSON.parse(t.prizeDistribution),
      slotsLeft: t.maxSlots - t.slotsFilled,
      isJoined,
      mySlot,
      participants,
      // Never leak room credentials to non-participants or before release,
      // regardless of what the client requests.
      roomId: canSeeRoom ? t.roomId : null,
      roomPassword: canSeeRoom ? t.roomPassword : null,
      currentUserId: userId,
    });
  } catch (error) {
    return fail(error);
  }
}
