import type Database from "better-sqlite3";
import { ApiError } from "./api-response";
import { createId } from "./ids";
import { pairKeyOf, type PublicUser } from "./friends";
import { validateGameUid, validateIgn } from "@/lib/game-uid";

/**
 * Teams (squads). Rules, all enforced here and backed by DB constraints:
 *  - a player is in at most ONE team per game  (TeamMember UNIQUE(userId, gameId))
 *  - only the captain invites / removes / renames / disbands / hands over captaincy
 *  - only accepted FRIENDS can be invited; the invitee must accept
 *  - a team holds up to TEAM_MAX_MEMBERS players (4 starters + 2 substitutes)
 *  - every member keeps their own IGN + Game UID for the team's game
 * Every function takes the database explicitly so it can be tested against an in-memory DB.
 */

type Db = Database.Database;

export const TEAM_MAX_MEMBERS = 6;
export const MAX_TEAMS_PER_USER = 5;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{2,23}$/;
const TAG_RE = /^[A-Za-z0-9]{2,5}$/;

export interface GameInfo { id: string; slug: string; name: string; iconUrl: string | null }
export interface TeamMemberItem { user: PublicUser; role: "CAPTAIN" | "MEMBER"; ign: string | null; gameUid: string | null; joinedAt: string }

export interface TeamSummary {
  id: string; name: string; tag: string; game: GameInfo;
  captainId: string; myRole: "CAPTAIN" | "MEMBER";
  memberCount: number; maxMembers: number; members: PublicUser[];
  /** My saved in-game name / UID for this team (used to prefill tournament registration). */
  myIgn: string | null; myGameUid: string | null;
}
export interface TeamInviteItem {
  inviteId: string; createdAt: string;
  team: { id: string; name: string; tag: string; game: GameInfo; memberCount: number };
  invitedBy: PublicUser;
}
export interface TeamDetail {
  team: { id: string; name: string; tag: string; game: GameInfo; captainId: string; maxMembers: number };
  myRole: "CAPTAIN" | "MEMBER";
  members: TeamMemberItem[];
  /** Captain only. */
  invites: { inviteId: string; user: PublicUser; createdAt: string }[];
  /** Captain only: accepted friends that could be invited right now. */
  inviteableFriends: PublicUser[];
  tournaments: { id: string; slug: string; title: string; status: string; matchStartsAt: string; players: string[] }[];
}

const normName = (raw: string) => raw.trim().replace(/\s+/g, " ");
const nameKeyOf = (name: string) => name.toLowerCase();

function notify(db: Db, userId: string, type: string, title: string, body: string, data: unknown, now: string) {
  db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    createId("notif"), userId, type, title, body, JSON.stringify(data), now
  );
}
const usernameOf = (db: Db, id: string) =>
  (db.prepare("SELECT username FROM User WHERE id = ?").get(id) as { username: string } | undefined)?.username ?? "Someone";

const gameOf = (db: Db, id: string) =>
  db.prepare("SELECT id, slug, name, iconUrl FROM Game WHERE id = ?").get(id) as GameInfo;

const pub = (r: { id: string; username: string; displayName: string | null; avatarUrl: string | null }): PublicUser => ({
  id: r.id, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl,
});

interface TeamRow { id: string; name: string; tag: string; gameId: string; captainId: string }

function memberRole(db: Db, teamId: string, userId: string) {
  return (db.prepare("SELECT role FROM TeamMember WHERE teamId = ? AND userId = ?").get(teamId, userId) as { role: "CAPTAIN" | "MEMBER" } | undefined)?.role;
}
function memberCount(db: Db, teamId: string) {
  return (db.prepare("SELECT COUNT(*) AS n FROM TeamMember WHERE teamId = ?").get(teamId) as { n: number }).n;
}

/** Same 404 for "doesn't exist" and "not your team" so team ids can't be probed. */
function requireMember(db: Db, meId: string, teamId: string): { team: TeamRow; role: "CAPTAIN" | "MEMBER" } {
  const team = db.prepare("SELECT id, name, tag, gameId, captainId FROM Team WHERE id = ?").get(teamId) as TeamRow | undefined;
  const role = team && memberRole(db, teamId, meId);
  if (!team || !role) throw new ApiError(404, "Team not found.", "TEAM_NOT_FOUND");
  return { team, role };
}
function requireCaptain(db: Db, meId: string, teamId: string) {
  const r = requireMember(db, meId, teamId);
  if (r.role !== "CAPTAIN") throw new ApiError(403, "Only the team captain can do that.", "NOT_CAPTAIN");
  return r.team;
}

const alreadyInGameTeam = (db: Db, userId: string, gameId: string) =>
  !!db.prepare("SELECT 1 FROM TeamMember WHERE userId = ? AND gameId = ?").get(userId, gameId);

function validateIdentity(gameSlug: string, ign?: string | null, gameUid?: string | null) {
  const i = ign?.trim() || null;
  const u = gameUid?.trim() || null;
  if (i) { const e = validateIgn(i); if (e) throw new ApiError(400, e, "INVALID_IGN"); }
  if (u) { const e = validateGameUid(gameSlug, u); if (e) throw new ApiError(400, e, "INVALID_GAME_UID"); }
  return { ign: i, gameUid: u };
}

function checkNameTag(name: string, tag: string) {
  if (!NAME_RE.test(name)) throw new ApiError(400, "Team name must be 3–24 characters: letters, numbers, spaces, _ or -.", "INVALID_TEAM_NAME");
  if (!TAG_RE.test(tag)) throw new ApiError(400, "Team tag must be 2–5 letters or numbers.", "INVALID_TEAM_TAG");
}

function nameTaken(e: unknown) {
  return e instanceof Error && /UNIQUE constraint failed: Team\.nameKey/.test(e.message);
}

export function createTeam(
  db: Db, meId: string,
  input: { name: string; tag: string; gameId: string; ign?: string | null; gameUid?: string | null },
  now = new Date()
): { id: string } {
  const name = normName(input.name);
  const tag = input.tag.trim().toUpperCase();
  checkNameTag(name, tag);

  try {
    return db.transaction(() => {
      const game = db.prepare("SELECT id, slug FROM Game WHERE id = ? AND isActive = 1").get(input.gameId) as { id: string; slug: string } | undefined;
      if (!game) throw new ApiError(400, "Choose a game for your team.", "INVALID_GAME");
      const mine = (db.prepare("SELECT COUNT(*) AS n FROM TeamMember WHERE userId = ?").get(meId) as { n: number }).n;
      if (mine >= MAX_TEAMS_PER_USER) throw new ApiError(409, `You can be in at most ${MAX_TEAMS_PER_USER} teams.`, "TOO_MANY_TEAMS");
      if (alreadyInGameTeam(db, meId, game.id)) throw new ApiError(409, "You are already in a team for this game.", "ALREADY_IN_GAME_TEAM");
      const identity = validateIdentity(game.slug, input.ign, input.gameUid);

      const id = createId("team");
      const iso = now.toISOString();
      db.prepare(`INSERT INTO Team (id, name, nameKey, tag, gameId, captainId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, name, nameKeyOf(name), tag, game.id, meId, iso, iso
      );
      db.prepare(`INSERT INTO TeamMember (teamId, userId, gameId, role, ign, gameUid, joinedAt) VALUES (?, ?, ?, 'CAPTAIN', ?, ?, ?)`).run(
        id, meId, game.id, identity.ign, identity.gameUid, iso
      );
      return { id };
    })();
  } catch (e) {
    if (nameTaken(e)) throw new ApiError(409, "That team name is already taken.", "TEAM_NAME_TAKEN");
    throw e;
  }
}

export function updateTeam(db: Db, meId: string, teamId: string, input: { name?: string; tag?: string }, now = new Date()) {
  const team = requireCaptain(db, meId, teamId);
  const name = input.name !== undefined ? normName(input.name) : team.name;
  const tag = input.tag !== undefined ? input.tag.trim().toUpperCase() : team.tag;
  checkNameTag(name, tag);
  try {
    db.prepare("UPDATE Team SET name = ?, nameKey = ?, tag = ?, updatedAt = ? WHERE id = ?").run(name, nameKeyOf(name), tag, now.toISOString(), team.id);
  } catch (e) {
    if (nameTaken(e)) throw new ApiError(409, "That team name is already taken.", "TEAM_NAME_TAKEN");
    throw e;
  }
}

export function listMyTeams(db: Db, meId: string): TeamSummary[] {
  const teams = db
    .prepare(
      `SELECT t.id, t.name, t.tag, t.gameId, t.captainId, m.role AS myRole, m.ign AS myIgn, m.gameUid AS myGameUid
       FROM Team t JOIN TeamMember m ON m.teamId = t.id AND m.userId = ? ORDER BY t.createdAt DESC`
    )
    .all(meId) as (TeamRow & { myRole: "CAPTAIN" | "MEMBER"; myIgn: string | null; myGameUid: string | null })[];

  return teams.map((t) => {
    const members = (
      db
        .prepare(
          `SELECT u.id, u.username, u.displayName, u.avatarUrl FROM TeamMember m JOIN User u ON u.id = m.userId
           WHERE m.teamId = ? ORDER BY (m.role = 'CAPTAIN') DESC, m.joinedAt`
        )
        .all(t.id) as { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
    ).map(pub);
    return { id: t.id, name: t.name, tag: t.tag, game: gameOf(db, t.gameId), captainId: t.captainId, myRole: t.myRole, memberCount: members.length, maxMembers: TEAM_MAX_MEMBERS, members, myIgn: t.myIgn, myGameUid: t.myGameUid };
  });
}

export function listMyInvites(db: Db, meId: string): TeamInviteItem[] {
  const rows = db
    .prepare(
      `SELECT i.id AS inviteId, i.createdAt, t.id AS teamId, t.name, t.tag, t.gameId,
              u.id, u.username, u.displayName, u.avatarUrl
       FROM TeamInvite i JOIN Team t ON t.id = i.teamId JOIN User u ON u.id = i.invitedById
       WHERE i.inviteeId = ? ORDER BY i.createdAt DESC`
    )
    .all(meId) as { inviteId: string; createdAt: string; teamId: string; name: string; tag: string; gameId: string; id: string; username: string; displayName: string | null; avatarUrl: string | null }[];
  return rows.map((r) => ({
    inviteId: r.inviteId, createdAt: r.createdAt,
    team: { id: r.teamId, name: r.name, tag: r.tag, game: gameOf(db, r.gameId), memberCount: memberCount(db, r.teamId) },
    invitedBy: pub(r),
  }));
}

export function getTeamDetail(db: Db, meId: string, teamId: string): TeamDetail {
  const { team, role } = requireMember(db, meId, teamId);

  const members = (
    db
      .prepare(
        `SELECT u.id, u.username, u.displayName, u.avatarUrl, m.role, m.ign, m.gameUid, m.joinedAt
         FROM TeamMember m JOIN User u ON u.id = m.userId WHERE m.teamId = ?
         ORDER BY (m.role = 'CAPTAIN') DESC, m.joinedAt`
      )
      .all(team.id) as (PublicUser & { role: "CAPTAIN" | "MEMBER"; ign: string | null; gameUid: string | null; joinedAt: string })[]
  ).map((r) => ({ user: pub(r), role: r.role, ign: r.ign, gameUid: r.gameUid, joinedAt: r.joinedAt }));

  let invites: TeamDetail["invites"] = [];
  let inviteableFriends: PublicUser[] = [];
  if (role === "CAPTAIN") {
    invites = (
      db
        .prepare(`SELECT i.id AS inviteId, i.createdAt, u.id, u.username, u.displayName, u.avatarUrl FROM TeamInvite i JOIN User u ON u.id = i.inviteeId WHERE i.teamId = ? ORDER BY i.createdAt DESC`)
        .all(team.id) as { inviteId: string; createdAt: string; id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
    ).map((r) => ({ inviteId: r.inviteId, createdAt: r.createdAt, user: pub(r) }));

    inviteableFriends = (
      db
        .prepare(
          `SELECT u.id, u.username, u.displayName, u.avatarUrl
           FROM Friendship f JOIN User u ON u.id = CASE WHEN f.requesterId = @me THEN f.addresseeId ELSE f.requesterId END
           WHERE f.status = 'ACCEPTED' AND (f.requesterId = @me OR f.addresseeId = @me) AND u.status = 'ACTIVE'
             AND NOT EXISTS (SELECT 1 FROM TeamMember tm WHERE tm.userId = u.id AND tm.gameId = @game)
             AND NOT EXISTS (SELECT 1 FROM TeamInvite ti WHERE ti.teamId = @team AND ti.inviteeId = u.id)
           ORDER BY u.username`
        )
        .all({ me: meId, game: team.gameId, team: team.id }) as { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
    ).map(pub);
  }

  const tournaments = (
    db
      .prepare(
        `SELECT DISTINCT t.id, t.slug, t.title, t.status, t.matchStartsAt
         FROM TournamentParticipant p JOIN Tournament t ON t.id = p.tournamentId
         WHERE p.teamId = ? ORDER BY t.matchStartsAt DESC LIMIT 20`
      )
      .all(team.id) as { id: string; slug: string; title: string; status: string; matchStartsAt: string }[]
  ).map((t) => ({
    ...t,
    players: (
      db
        .prepare(`SELECT u.username FROM TournamentParticipant p JOIN User u ON u.id = p.userId WHERE p.tournamentId = ? AND p.teamId = ? ORDER BY p.joinedAt`)
        .all(t.id, team.id) as { username: string }[]
    ).map((r) => r.username),
  }));

  return {
    team: { id: team.id, name: team.name, tag: team.tag, game: gameOf(db, team.gameId), captainId: team.captainId, maxMembers: TEAM_MAX_MEMBERS },
    myRole: role, members, invites, inviteableFriends, tournaments,
  };
}

export function inviteMember(db: Db, meId: string, teamId: string, targetId: string, now = new Date()): { inviteId: string } {
  const team = requireCaptain(db, meId, teamId);
  if (targetId === meId) throw new ApiError(400, "You are already in this team.", "SELF_INVITE");

  return db.transaction(() => {
    const target = db.prepare("SELECT id, status FROM User WHERE id = ?").get(targetId) as { id: string; status: string } | undefined;
    if (!target || target.status !== "ACTIVE") throw new ApiError(404, "Player not found.", "USER_NOT_FOUND");

    const friends = db.prepare("SELECT 1 FROM Friendship WHERE pairKey = ? AND status = 'ACCEPTED'").get(pairKeyOf(meId, targetId));
    if (!friends) throw new ApiError(403, "You can only invite your friends. Add them as a friend first.", "NOT_FRIENDS");

    if (alreadyInGameTeam(db, targetId, team.gameId)) {
      throw new ApiError(409, "This player is already in a team for this game.", "TARGET_IN_GAME_TEAM");
    }
    if (memberCount(db, team.id) >= TEAM_MAX_MEMBERS) throw new ApiError(409, `Team is full (${TEAM_MAX_MEMBERS} players max).`, "TEAM_FULL");
    if (db.prepare("SELECT 1 FROM TeamInvite WHERE teamId = ? AND inviteeId = ?").get(team.id, targetId)) {
      throw new ApiError(409, "Invite already sent.", "ALREADY_INVITED");
    }

    const id = createId("tinv");
    const iso = now.toISOString();
    db.prepare("INSERT INTO TeamInvite (id, teamId, inviteeId, invitedById, createdAt) VALUES (?, ?, ?, ?, ?)").run(id, team.id, targetId, meId, iso);
    notify(db, targetId, "TEAM_INVITE", "Team invite", `${usernameOf(db, meId)} invited you to join ${team.name}.`, { teamId: team.id, inviteId: id }, iso);
    return { inviteId: id };
  })();
}

export function cancelInvite(db: Db, meId: string, inviteId: string) {
  const inv = db.prepare("SELECT id, teamId FROM TeamInvite WHERE id = ?").get(inviteId) as { id: string; teamId: string } | undefined;
  if (!inv) throw new ApiError(404, "Invite not found.", "INVITE_NOT_FOUND");
  requireCaptain(db, meId, inv.teamId);
  db.prepare("DELETE FROM TeamInvite WHERE id = ?").run(inv.id);
}

/** Invitee accepts (joins the roster) or declines. Re-checks the rules at accept time — things change between invite and reply. */
export function respondToInvite(db: Db, meId: string, inviteId: string, accept: boolean, now = new Date()) {
  return db.transaction(() => {
    const inv = db.prepare("SELECT id, teamId, inviteeId FROM TeamInvite WHERE id = ?").get(inviteId) as { id: string; teamId: string; inviteeId: string } | undefined;
    if (!inv || inv.inviteeId !== meId) throw new ApiError(404, "Invite not found.", "INVITE_NOT_FOUND");
    const team = db.prepare("SELECT id, name, gameId, captainId FROM Team WHERE id = ?").get(inv.teamId) as TeamRow;

    if (!accept) {
      db.prepare("DELETE FROM TeamInvite WHERE id = ?").run(inv.id);
      return { accepted: false as const };
    }
    if (alreadyInGameTeam(db, meId, team.gameId)) {
      throw new ApiError(409, "You are already in a team for this game. Leave it first to join another.", "ALREADY_IN_GAME_TEAM");
    }
    if (memberCount(db, team.id) >= TEAM_MAX_MEMBERS) throw new ApiError(409, "This team is already full.", "TEAM_FULL");
    const mine = (db.prepare("SELECT COUNT(*) AS n FROM TeamMember WHERE userId = ?").get(meId) as { n: number }).n;
    if (mine >= MAX_TEAMS_PER_USER) throw new ApiError(409, `You can be in at most ${MAX_TEAMS_PER_USER} teams.`, "TOO_MANY_TEAMS");

    const iso = now.toISOString();
    db.prepare(`INSERT INTO TeamMember (teamId, userId, gameId, role, joinedAt) VALUES (?, ?, ?, 'MEMBER', ?)`).run(team.id, meId, team.gameId, iso);
    // Invites to other teams of the same game can no longer be accepted.
    db.prepare(`DELETE FROM TeamInvite WHERE inviteeId = ? AND (id = ? OR teamId IN (SELECT id FROM Team WHERE gameId = ?))`).run(meId, inv.id, team.gameId);
    notify(db, team.captainId, "TEAM_JOINED", "New team member", `${usernameOf(db, meId)} joined ${team.name}.`, { teamId: team.id }, iso);
    return { accepted: true as const, teamId: team.id };
  })();
}

/** Leave (userId = me) or, for the captain, remove someone else. The captain can't leave without handing over or disbanding. */
export function removeMember(db: Db, meId: string, teamId: string, userId: string, now = new Date()) {
  const { team, role } = requireMember(db, meId, teamId);
  if (userId === meId) {
    if (role === "CAPTAIN") {
      throw new ApiError(409, memberCount(db, team.id) > 1 ? "Make another member captain before leaving, or disband the team." : "You're the only member — disband the team instead.", "CAPTAIN_CANNOT_LEAVE");
    }
  } else {
    if (role !== "CAPTAIN") throw new ApiError(403, "Only the team captain can remove members.", "NOT_CAPTAIN");
    if (!memberRole(db, team.id, userId)) throw new ApiError(404, "That player is not in this team.", "MEMBER_NOT_FOUND");
  }
  db.prepare("DELETE FROM TeamMember WHERE teamId = ? AND userId = ?").run(team.id, userId);
  const iso = now.toISOString();
  if (userId !== meId) {
    notify(db, userId, "TEAM_REMOVED", "Removed from team", `You were removed from ${team.name}.`, { teamId: team.id }, iso);
  } else {
    notify(db, team.captainId, "TEAM_LEFT", "Member left", `${usernameOf(db, meId)} left ${team.name}.`, { teamId: team.id }, iso);
  }
}

export function transferCaptain(db: Db, meId: string, teamId: string, newCaptainId: string) {
  const team = requireCaptain(db, meId, teamId);
  if (newCaptainId === meId) throw new ApiError(400, "You are already the captain.", "ALREADY_CAPTAIN");
  db.transaction(() => {
    if (!memberRole(db, team.id, newCaptainId)) throw new ApiError(404, "That player is not in this team.", "MEMBER_NOT_FOUND");
    db.prepare("UPDATE TeamMember SET role = 'MEMBER' WHERE teamId = ? AND userId = ?").run(team.id, meId);
    db.prepare("UPDATE TeamMember SET role = 'CAPTAIN' WHERE teamId = ? AND userId = ?").run(team.id, newCaptainId);
    db.prepare("UPDATE Team SET captainId = ? WHERE id = ?").run(newCaptainId, team.id);
  })();
}

/** A member edits only their OWN in-game name / UID for this team's game. */
export function updateMyDetails(db: Db, meId: string, teamId: string, input: { ign: string; gameUid: string }) {
  const { team } = requireMember(db, meId, teamId);
  const slug = (db.prepare("SELECT slug FROM Game WHERE id = ?").get(team.gameId) as { slug: string }).slug;
  const ign = validateIgn(input.ign);
  if (ign) throw new ApiError(400, ign, "INVALID_IGN");
  const uid = validateGameUid(slug, input.gameUid);
  if (uid) throw new ApiError(400, uid, "INVALID_GAME_UID");
  db.prepare("UPDATE TeamMember SET ign = ?, gameUid = ? WHERE teamId = ? AND userId = ?").run(input.ign.trim(), input.gameUid.trim(), team.id, meId);
}

/** Deletes the team (members + invites cascade). Past tournament entries keep their text team name but lose the link. */
export function disbandTeam(db: Db, meId: string, teamId: string, now = new Date()) {
  const team = requireCaptain(db, meId, teamId);
  db.transaction(() => {
    const others = db.prepare("SELECT userId FROM TeamMember WHERE teamId = ? AND userId <> ?").all(team.id, meId) as { userId: string }[];
    const iso = now.toISOString();
    for (const o of others) notify(db, o.userId, "TEAM_DISBANDED", "Team disbanded", `${team.name} was disbanded by the captain.`, {}, iso);
    db.prepare("UPDATE TournamentParticipant SET teamId = NULL WHERE teamId = ?").run(team.id);
    db.prepare("DELETE FROM Team WHERE id = ?").run(team.id);
  })();
}

/**
 * Used by the tournament join: the player may enter "as" one of their teams, but only a team
 * they belong to and only for that team's own game. Returns the data to snapshot on the entry.
 */
export function resolveTeamEntry(db: Db, userId: string, teamId: string, tournamentGameId: string): { id: string; name: string } {
  const row = db
    .prepare(`SELECT t.id, t.name, t.gameId FROM Team t JOIN TeamMember m ON m.teamId = t.id AND m.userId = ? WHERE t.id = ?`)
    .get(userId, teamId) as { id: string; name: string; gameId: string } | undefined;
  if (!row) throw new ApiError(404, "Team not found.", "TEAM_NOT_FOUND");
  if (row.gameId !== tournamentGameId) throw new ApiError(400, "This team plays a different game than this tournament.", "TEAM_GAME_MISMATCH");
  return { id: row.id, name: row.name };
}

/** The player's teams for one game (normally 0 or 1) with their saved IGN/UID — to prefill the register form. */
export function teamsForGame(db: Db, userId: string, gameId: string) {
  return db
    .prepare(
      `SELECT t.id, t.name, t.tag, m.ign, m.gameUid FROM TeamMember m JOIN Team t ON t.id = m.teamId
       WHERE m.userId = ? AND m.gameId = ? ORDER BY t.name`
    )
    .all(userId, gameId) as { id: string; name: string; tag: string; ign: string | null; gameUid: string | null }[];
}
