import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser, walletOf, type Seed } from "../../providers/__tests__/helpers";
import { releaseDueRooms, saveRoom } from "../room-release";
import { settleTournament } from "../match-settlement";
import { matchPlayer, parseScoreboard } from "@/lib/scoreboard";

let db: Database.Database;
let players: Seed[];
let parts: string[];
const T = "t1";
const START = "2026-12-01T10:00:00.000Z";

function setup(opts: { roomSize?: number; prizes?: { position: number; amount: number }[] } = {}) {
  db = makeDb();
  db.prepare("INSERT INTO Game (id, name, slug, isActive, supportedModes) VALUES ('g1','Free Fire','free-fire',1,'[]')").run();
  db.prepare(
    `INSERT INTO Tournament (id, slug, title, description, gameId, mode, format, status, entryFee, prizePool, prizeDistribution, maxSlots, slotsFilled, roomSize, rules, registrationStartsAt, registrationEndsAt, matchStartsAt, createdById)
     VALUES (?, 's', 'Cup', 'd', 'g1', 'SOLO', 'PAID', 'REGISTRATION_OPEN', 0, 100000, ?, 10, 3, ?, 'r', 'x', 'x', ?, 'admin')`
  ).run(T, JSON.stringify(opts.prizes ?? [{ position: 1, amount: 50000 }, { position: 2, amount: 20000 }]), opts.roomSize ?? 1, START);
  players = [1, 2, 3].map((n) => seedUser(db, { n }));
  parts = players.map((p, i) => {
    db.prepare("INSERT INTO PlayerStats (id, userId, updatedAt) VALUES (?, ?, 'x')").run(`ps${i}`, p.userId);
    db.prepare("INSERT INTO TournamentParticipant (id, tournamentId, userId, ign, gameUid, teamName, slotNumber) VALUES (?, ?, ?, ?, ?, ?, ?)").run(`tp${i}`, T, p.userId, `IGN${i}`, `UID${i}`, opts.roomSize ? "Team A" : null, opts.roomSize ? 1 : null);
    return `tp${i}`;
  });
}
const room = () => db.prepare("SELECT status, roomId, roomReleasedAt, roomReleaseAt FROM Tournament WHERE id = ?").get(T) as { status: string; roomId: string | null; roomReleasedAt: string | null; roomReleaseAt: string | null };
const notifs = () => (db.prepare("SELECT COUNT(*) c FROM Notification WHERE type = 'ROOM_RELEASED'").get() as { c: number }).c;

describe("auto room release", () => {
  beforeEach(() => setup());

  it("releases immediately when no schedule is given", () => {
    const r = saveRoom(db, { tournamentId: T, roomId: "111", roomPassword: "pw", now: "2026-12-01T09:00:00.000Z" });
    expect(r.released).toBe(true);
    expect(room().roomReleasedAt).not.toBeNull();
    expect(notifs()).toBe(3);
  });

  it("holds the room, then releases once on time, exactly once", () => {
    const r = saveRoom(db, { tournamentId: T, roomId: "111", roomPassword: "pw", releaseMinutesBefore: 10, now: "2026-12-01T08:00:00.000Z" });
    expect(r).toEqual({ released: false, releaseAt: "2026-12-01T09:50:00.000Z" });
    expect(releaseDueRooms(db, "2026-12-01T09:49:00.000Z")).toBe(0);
    expect(room().roomReleasedAt).toBeNull();
    expect(releaseDueRooms(db, "2026-12-01T09:50:00.000Z")).toBe(1);
    expect(releaseDueRooms(db, "2026-12-01T09:55:00.000Z")).toBe(0);
    expect(room().status).toBe("LIVE");
    expect(notifs()).toBe(3);
  });

  it("releases at once if the scheduled time already passed", () => {
    const r = saveRoom(db, { tournamentId: T, roomId: "111", roomPassword: "pw", releaseMinutesBefore: 10, now: "2026-12-01T09:55:00.000Z" });
    expect(r.released).toBe(true);
  });

  it("does not release cancelled tournaments", () => {
    saveRoom(db, { tournamentId: T, roomId: "111", roomPassword: "pw", releaseMinutesBefore: 10, now: "2026-12-01T08:00:00.000Z" });
    db.prepare("UPDATE Tournament SET status = 'CANCELLED' WHERE id = ?").run(T);
    expect(releaseDueRooms(db, "2026-12-01T10:00:00.000Z")).toBe(0);
  });
});

describe("settle results", () => {
  beforeEach(() => setup());
  const NOW = "2026-12-01T11:00:00.000Z";

  it("pays placement prize plus kill reward, completes the tournament, updates stats", () => {
    const out = settleTournament(db, {
      tournamentId: T, adminId: "admin", killRewardPaise: 1000, now: NOW,
      rows: [{ participantId: parts[0], placement: 1, kills: 5 }, { participantId: parts[1], placement: 2, kills: 2 }, { participantId: parts[2], placement: 3, kills: 1 }],
    });
    expect(out.paidPaise).toBe(50000 + 5000 + 20000 + 2000 + 1000);
    expect(walletOf(db, players[0].userId).winning).toBe(55000);
    expect(walletOf(db, players[1].userId).winning).toBe(22000);
    expect(walletOf(db, players[2].userId).winning).toBe(1000);
    expect(db.prepare("SELECT status FROM Tournament WHERE id = ?").get(T)).toEqual({ status: "COMPLETED" });
    const s = db.prepare("SELECT matchesPlayed, kills, wins FROM PlayerStats WHERE userId = ?").get(players[0].userId);
    expect(s).toEqual({ matchesPlayed: 1, kills: 5, wins: 1 });
    expect((db.prepare(`SELECT COUNT(*) c FROM "Transaction" WHERE type = 'TOURNAMENT_PRIZE'`).get() as { c: number }).c).toBe(3);
  });

  it("cannot be settled twice", () => {
    const rows = [{ participantId: parts[0], placement: 1, kills: 1 }];
    settleTournament(db, { tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW, rows });
    expect(() => settleTournament(db, { tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW, rows })).toThrow("ALREADY_COMPLETED");
    expect(walletOf(db, players[0].userId).winning).toBe(50000);
  });

  it("rejects unknown or duplicate players and changes nothing", () => {
    expect(() => settleTournament(db, { tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW, rows: [{ participantId: "nope", placement: 1, kills: 0 }] })).toThrow("UNKNOWN_PARTICIPANT");
    expect(() => settleTournament(db, { tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW, rows: [{ participantId: parts[0], placement: 1, kills: 0 }, { participantId: parts[0], placement: 2, kills: 0 }] })).toThrow("DUPLICATE_PARTICIPANT");
    expect(db.prepare("SELECT status FROM Tournament WHERE id = ?").get(T)).toEqual({ status: "REGISTRATION_OPEN" });
  });

  it("replaces pending player-submitted results", () => {
    db.prepare("INSERT INTO Match (id, tournamentId, round, status) VALUES ('m1', ?, 1, 'SCHEDULED')").run(T);
    db.prepare("INSERT INTO MatchResult (id, matchId, userId, placement, kills) VALUES ('mr1','m1',?,9,99)").run(players[0].userId);
    settleTournament(db, { tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW, rows: [{ participantId: parts[0], placement: 1, kills: 1 }] });
    expect(db.prepare("SELECT placement, kills FROM MatchResult WHERE userId = ?").all(players[0].userId)).toEqual([{ placement: 1, kills: 1 }]);
  });

  it("squads split a placement prize equally", () => {
    setup({ roomSize: 4 });
    const out = settleTournament(db, {
      tournamentId: T, adminId: "a", killRewardPaise: 0, now: NOW,
      rows: parts.map((participantId) => ({ participantId, placement: 1, kills: 0 })),
    });
    expect(out.paidPaise).toBe(3 * Math.floor(50000 / 3));
  });
});

describe("scoreboard paste", () => {
  const roster = [
    { participantId: "a", username: "alpha", ign: "Shadow Strike", gameUid: "1234567" },
    { participantId: "b", username: "bravo", ign: null, gameUid: null },
  ];
  it("parses comma, tab, pipe and space formats and reports bad lines", () => {
    const { lines, bad } = parseScoreboard("1, Shadow Strike, 7\n2\tbravo\t3\n3 | X | 0\n4 Name With Space 2\nnonsense");
    expect(lines).toEqual([
      { placement: 1, name: "Shadow Strike", kills: 7 },
      { placement: 2, name: "bravo", kills: 3 },
      { placement: 3, name: "X", kills: 0 },
      { placement: 4, name: "Name With Space", kills: 2 },
    ]);
    expect(bad).toEqual(["nonsense"]);
  });
  it("matches by IGN, UID or username, ignoring case and symbols, and flags strangers", () => {
    expect(matchPlayer("shadow-strike", roster)?.participantId).toBe("a");
    expect(matchPlayer("1234567", roster)?.participantId).toBe("a");
    expect(matchPlayer("BRAVO", roster)?.participantId).toBe("b");
    expect(matchPlayer("stranger", roster)).toBeNull();
  });
});
