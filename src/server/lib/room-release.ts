import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";

type Db = Database.Database;

/** Stores room details and either releases them now or schedules the automatic release. */
export function saveRoom(db: Db, o: { tournamentId: string; roomId: string; roomPassword: string; releaseMinutesBefore?: number; now: string }): { released: boolean; releaseAt: string | null } {
  const t = db.prepare("SELECT matchStartsAt FROM Tournament WHERE id = ?").get(o.tournamentId) as { matchStartsAt: string };
  if (o.releaseMinutesBefore === undefined) {
    db.prepare("UPDATE Tournament SET roomId = ?, roomPassword = ?, roomReleaseAt = NULL, updatedAt = ? WHERE id = ?").run(o.roomId, o.roomPassword, o.now, o.tournamentId);
    releaseNow(db, o.tournamentId, o.now);
    return { released: true, releaseAt: null };
  }
  const releaseAt = new Date(new Date(t.matchStartsAt).getTime() - o.releaseMinutesBefore * 60_000).toISOString();
  db.prepare("UPDATE Tournament SET roomId = ?, roomPassword = ?, roomReleaseAt = ?, roomReleasedAt = NULL, updatedAt = ? WHERE id = ?").run(o.roomId, o.roomPassword, releaseAt, o.now, o.tournamentId);
  if (releaseAt <= o.now) {
    releaseNow(db, o.tournamentId, o.now);
    return { released: true, releaseAt };
  }
  return { released: false, releaseAt };
}

/** Marks the room as released, sets the tournament LIVE and notifies every participant. Idempotent. */
export function releaseNow(db: Db, tournamentId: string, now: string): boolean {
  const claim = db
    .prepare("UPDATE Tournament SET roomReleasedAt = ?, roomReleaseAt = NULL, status = 'LIVE', updatedAt = ? WHERE id = ? AND roomId IS NOT NULL AND roomReleasedAt IS NULL")
    .run(now, now, tournamentId);
  if (claim.changes === 0) return false;
  const participants = db.prepare("SELECT userId FROM TournamentParticipant WHERE tournamentId = ?").all(tournamentId) as { userId: string }[];
  const ins = db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'ROOM_RELEASED', ?, ?, ?, ?)`);
  for (const p of participants) {
    ins.run(createId("notif"), p.userId, "Room ID released! 🔑", "Your match room details are now available. Head to the tournament page to join.", JSON.stringify({ tournamentId }), now);
  }
  return true;
}

/** Releases every scheduled room whose time has come. Safe to call as often as you like. */
export function releaseDueRooms(db: Db, nowIso = new Date().toISOString()): number {
  const due = db
    .prepare("SELECT id FROM Tournament WHERE roomId IS NOT NULL AND roomReleasedAt IS NULL AND roomReleaseAt IS NOT NULL AND roomReleaseAt <= ? AND status NOT IN ('CANCELLED','COMPLETED','DRAFT')")
    .all(nowIso) as { id: string }[];
  let n = 0;
  for (const t of due) if (db.transaction(() => releaseNow(db, t.id, nowIso))()) n++;
  return n;
}
