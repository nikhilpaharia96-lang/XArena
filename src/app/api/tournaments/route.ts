import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { verifyAccessToken, ACCESS_COOKIE_NAME } from "@/server/lib/auth";
import { cookies } from "next/headers";

interface TournamentRow {
  id: string;
  slug: string;
  title: string;
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
  maxSlots: number;
  slotsFilled: number;
  roomSize: number;
  map: string | null;
  registrationStartsAt: string;
  registrationEndsAt: string;
  matchStartsAt: string;
  isFeatured: number;
}

/**
 * GET /api/tournaments?game=free-fire-max&status=REGISTRATION_OPEN&format=PAID&featured=1
 *
 * Public endpoint (no auth required to browse). If the caller has a valid
 * session, we additionally annotate each tournament with `isJoined` so the
 * UI can render "Joined" vs "Join" without a second round trip per card.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameSlug = url.searchParams.get("game");
    const status = url.searchParams.get("status");
    const format = url.searchParams.get("format");
    const featured = url.searchParams.get("featured");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

    let query = `
      SELECT t.id, t.slug, t.title, t.bannerUrl, t.gameId, g.name as gameName, g.slug as gameSlug, g.iconUrl as gameIcon,
             t.mode, t.format, t.cadence, t.status, t.entryFee, t.prizePool, t.maxSlots, t.slotsFilled,
             t.roomSize, t.map, t.registrationStartsAt, t.registrationEndsAt, t.matchStartsAt, t.isFeatured
      FROM Tournament t
      JOIN Game g ON g.id = t.gameId
      WHERE t.status NOT IN ('DRAFT', 'CANCELLED')
    `;
    const params: (string | number)[] = [];

    if (gameSlug) {
      query += " AND g.slug = ?";
      params.push(gameSlug);
    }
    if (status) {
      query += " AND t.status = ?";
      params.push(status);
    }
    if (format) {
      query += " AND t.format = ?";
      params.push(format);
    }
    if (featured === "1") {
      query += " AND t.isFeatured = 1";
    }
    query += " ORDER BY t.matchStartsAt ASC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params) as TournamentRow[];

    // Best-effort: annotate isJoined if the caller is authenticated.
    let joinedIds = new Set<string>();
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const joins = db
          .prepare("SELECT tournamentId FROM TournamentParticipant WHERE userId = ?")
          .all(payload.sub) as { tournamentId: string }[];
        joinedIds = new Set(joins.map((j) => j.tournamentId));
      }
    }

    const data = rows.map((t) => ({
      ...t,
      isFeatured: Boolean(t.isFeatured),
      slotsLeft: t.maxSlots - t.slotsFilled,
      isJoined: joinedIds.has(t.id),
    }));

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
