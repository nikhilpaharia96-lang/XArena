import { describe, expect, it } from "vitest";
import { makeDb, seedUser } from "@/server/providers/__tests__/helpers";
import { respondToRequest, sendFriendRequest } from "../friends";
import {
  cancelInvite, createTeam, disbandTeam, getTeamDetail, inviteMember, listMyInvites, listMyTeams,
  removeMember, resolveTeamEntry, respondToInvite, teamsForGame, transferCaptain, updateMyDetails, updateTeam,
  TEAM_MAX_MEMBERS,
} from "../teams";

function setup(users = 3) {
  const db = makeDb();
  const ids = Array.from({ length: users }, (_, i) => seedUser(db, { n: i + 1 }).userId);
  for (const [id, slug, name] of [["g_ff", "free-fire-max", "Free Fire MAX"], ["g_bgmi", "bgmi", "BGMI"]]) {
    db.prepare("INSERT INTO Game (id, slug, name, supportedModes) VALUES (?, ?, ?, '[]')").run(id, slug, name);
  }
  return { db, ids };
}
const friends = (db: ReturnType<typeof makeDb>, a: string, b: string) => {
  const r = sendFriendRequest(db, a, b);
  if (r.status === "PENDING") respondToRequest(db, b, r.friendshipId, true);
};
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as { code?: string }).code; } return "NO_ERROR"; };
const mk = (db: ReturnType<typeof makeDb>, me: string, over: Partial<Parameters<typeof createTeam>[2]> = {}) =>
  createTeam(db, me, { name: "Alpha Squad", tag: "alp", gameId: "g_ff", ...over }).id;

describe("create / edit team", () => {
  it("creates a team with the creator as captain; tag is upper-cased", () => {
    const { db, ids: [a] } = setup();
    const id = mk(db, a, { ign: "Alpha", gameUid: "123456789" });
    const d = getTeamDetail(db, a, id);
    expect(d.team).toMatchObject({ name: "Alpha Squad", tag: "ALP", captainId: a, game: { slug: "free-fire-max" } });
    expect(d.myRole).toBe("CAPTAIN");
    expect(d.members).toHaveLength(1);
    expect(d.members[0]).toMatchObject({ role: "CAPTAIN", ign: "Alpha", gameUid: "123456789" });
  });

  it("validates name, tag, game and game UID", () => {
    const { db, ids: [a] } = setup();
    expect(code(() => mk(db, a, { name: "ab" }))).toBe("INVALID_TEAM_NAME");
    expect(code(() => mk(db, a, { name: "<script>" }))).toBe("INVALID_TEAM_NAME");
    expect(code(() => mk(db, a, { tag: "X" }))).toBe("INVALID_TEAM_TAG");
    expect(code(() => mk(db, a, { gameId: "nope" }))).toBe("INVALID_GAME");
    expect(code(() => mk(db, a, { gameUid: "abc" }))).toBe("INVALID_GAME_UID");
  });

  it("team names are unique case-insensitively; one team per game per player", () => {
    const { db, ids: [a, b] } = setup();
    mk(db, a);
    expect(code(() => mk(db, b, { name: "  alpha   SQUAD " }))).toBe("TEAM_NAME_TAKEN");
    expect(code(() => mk(db, a, { name: "Other" }))).toBe("ALREADY_IN_GAME_TEAM");
    expect(code(() => mk(db, a, { name: "Other", gameId: "g_bgmi" }))).toBe("NO_ERROR");
    expect(listMyTeams(db, a)).toHaveLength(2);
  });

  it("only the captain can rename; rename can't collide", () => {
    const { db, ids: [a, b] } = setup();
    const t = mk(db, a);
    mk(db, b, { name: "Bravo", gameId: "g_bgmi" });
    expect(code(() => updateTeam(db, b, t, { name: "Hacked" }))).toBe("TEAM_NOT_FOUND");
    expect(code(() => updateTeam(db, a, t, { name: "bravo" }))).toBe("TEAM_NAME_TAKEN");
    updateTeam(db, a, t, { name: "Alpha Prime", tag: "ap" });
    expect(getTeamDetail(db, a, t).team).toMatchObject({ name: "Alpha Prime", tag: "AP" });
  });
});

describe("invites", () => {
  it("captain invites a friend; friend accepts and joins as MEMBER", () => {
    const { db, ids: [a, b] } = setup();
    const t = mk(db, a); friends(db, a, b);
    expect(getTeamDetail(db, a, t).inviteableFriends.map((u) => u.id)).toEqual([b]);
    const { inviteId } = inviteMember(db, a, t, b);
    expect(getTeamDetail(db, a, t).inviteableFriends).toEqual([]);
    expect(listMyInvites(db, b)).toHaveLength(1);
    expect(listMyInvites(db, b)[0]).toMatchObject({ inviteId, team: { id: t, memberCount: 1 } });
    expect(respondToInvite(db, b, inviteId, true)).toMatchObject({ accepted: true });
    const d = getTeamDetail(db, b, t);
    expect(d.members.map((m) => m.role)).toEqual(["CAPTAIN", "MEMBER"]);
    expect(d.myRole).toBe("MEMBER");
    expect(d.invites).toEqual([]); // members never see captain-only data
    expect(d.inviteableFriends).toEqual([]);
    expect(listMyInvites(db, b)).toHaveLength(0);
  });

  it("only the captain may invite, and only accepted friends", () => {
    const { db, ids: [a, b, c] } = setup();
    const t = mk(db, a); friends(db, a, b); friends(db, b, c);
    expect(code(() => inviteMember(db, a, t, c))).toBe("NOT_FRIENDS");
    respondToInvite(db, b, inviteMember(db, a, t, b).inviteId, true);
    expect(code(() => inviteMember(db, b, t, c))).toBe("NOT_CAPTAIN");
    expect(code(() => inviteMember(db, c, t, b))).toBe("TEAM_NOT_FOUND");
    expect(code(() => inviteMember(db, a, t, a))).toBe("SELF_INVITE");
    expect(code(() => inviteMember(db, a, t, "ghost"))).toBe("USER_NOT_FOUND");
  });

  it("blocks duplicates, players already in a team for that game, and decline/cancel work", () => {
    const { db, ids: [a, b, c] } = setup();
    const t = mk(db, a); friends(db, a, b); friends(db, a, c);
    const inv = inviteMember(db, a, t, b);
    expect(code(() => inviteMember(db, a, t, b))).toBe("ALREADY_INVITED");
    respondToInvite(db, b, inv.inviteId, false);
    expect(listMyInvites(db, b)).toHaveLength(0);
    mk(db, c, { name: "Charlie Co" });
    expect(code(() => inviteMember(db, a, t, c))).toBe("TARGET_IN_GAME_TEAM");
    const again = inviteMember(db, a, t, b);
    expect(code(() => cancelInvite(db, b, again.inviteId))).toBe("TEAM_NOT_FOUND");
    cancelInvite(db, a, again.inviteId);
    expect(code(() => respondToInvite(db, b, again.inviteId, true))).toBe("INVITE_NOT_FOUND");
  });

  it("another player can't answer someone else's invite", () => {
    const { db, ids: [a, b, c] } = setup();
    const t = mk(db, a); friends(db, a, b);
    const inv = inviteMember(db, a, t, b);
    expect(code(() => respondToInvite(db, c, inv.inviteId, true))).toBe("INVITE_NOT_FOUND");
  });

  it("re-checks at accept time: joined another team for the game meanwhile; and accepting clears sibling invites", () => {
    const { db, ids: [a, b, c] } = setup();
    const t1 = mk(db, a); const t2 = mk(db, c, { name: "Charlie Co" });
    friends(db, a, b); friends(db, c, b);
    const i1 = inviteMember(db, a, t1, b); const i2 = inviteMember(db, c, t2, b);
    respondToInvite(db, b, i1.inviteId, true);
    expect(listMyInvites(db, b)).toHaveLength(0); // i2 (same game) removed
    expect(code(() => respondToInvite(db, b, i2.inviteId, true))).toBe("INVITE_NOT_FOUND");
  });

  it(`a team holds at most ${TEAM_MAX_MEMBERS} players`, () => {
    const { db, ids } = setup(TEAM_MAX_MEMBERS + 2);
    const [cap, ...rest] = ids;
    const t = mk(db, cap);
    for (const u of rest.slice(0, TEAM_MAX_MEMBERS - 1)) { friends(db, cap, u); respondToInvite(db, u, inviteMember(db, cap, t, u).inviteId, true); }
    const extra = rest[TEAM_MAX_MEMBERS - 1]; friends(db, cap, extra);
    expect(code(() => inviteMember(db, cap, t, extra))).toBe("TEAM_FULL");
  });
});

describe("members, captaincy, disband", () => {
  function squad() {
    const s = setup();
    const [a, b, c] = s.ids;
    const t = mk(s.db, a);
    for (const u of [b, c]) { friends(s.db, a, u); respondToInvite(s.db, u, inviteMember(s.db, a, t, u).inviteId, true); }
    return { ...s, a, b, c, t };
  }

  it("members can leave; captain can't leave without handing over; captain can remove others", () => {
    const { db, a, b, c, t } = squad();
    expect(code(() => removeMember(db, a, t, a))).toBe("CAPTAIN_CANNOT_LEAVE");
    expect(code(() => removeMember(db, b, t, c))).toBe("NOT_CAPTAIN");
    removeMember(db, b, t, b);
    removeMember(db, a, t, c);
    expect(getTeamDetail(db, a, t).members).toHaveLength(1);
    expect(code(() => removeMember(db, a, t, c))).toBe("MEMBER_NOT_FOUND");
    expect(code(() => removeMember(db, a, t, a))).toBe("CAPTAIN_CANNOT_LEAVE");
    expect(code(() => getTeamDetail(db, b, t))).toBe("TEAM_NOT_FOUND");
  });

  it("transfer captaincy, then the old captain can leave", () => {
    const { db, a, b, t } = squad();
    expect(code(() => transferCaptain(db, b, t, b))).toBe("NOT_CAPTAIN");
    transferCaptain(db, a, t, b);
    expect(getTeamDetail(db, a, t)).toMatchObject({ myRole: "MEMBER", team: { captainId: b } });
    removeMember(db, a, t, a);
    expect(code(() => transferCaptain(db, b, t, "ghost"))).toBe("MEMBER_NOT_FOUND");
  });

  it("a member edits only their own IGN/UID (validated per game)", () => {
    const { db, b, c, t } = squad();
    updateMyDetails(db, b, t, { ign: "BravoYT", gameUid: "987654321" });
    expect(code(() => updateMyDetails(db, b, t, { ign: "x", gameUid: "987654321" }))).toBe("INVALID_IGN");
    expect(code(() => updateMyDetails(db, b, t, { ign: "BravoYT", gameUid: "12" }))).toBe("INVALID_GAME_UID");
    const m = getTeamDetail(db, c, t).members;
    expect(m.find((x) => x.user.id === b)).toMatchObject({ ign: "BravoYT", gameUid: "987654321" });
    expect(m.find((x) => x.user.id === c)).toMatchObject({ ign: null, gameUid: null });
  });

  it("disband is captain-only, frees members to join other teams, and unlinks past entries", () => {
    const { db, a, b, t } = squad();
    expect(code(() => disbandTeam(db, b, t))).toBe("NOT_CAPTAIN");
    db.pragma("foreign_keys = OFF"); // no Tournament row needed for this link check
    db.prepare("INSERT INTO TournamentParticipant (id, tournamentId, userId, teamId) VALUES ('p1', 'x', ?, ?)").run(a, t);
    db.pragma("foreign_keys = ON");
    disbandTeam(db, a, t);
    expect(listMyTeams(db, b)).toHaveLength(0);
    expect(db.prepare("SELECT teamId FROM TournamentParticipant WHERE id = 'p1'").get()).toEqual({ teamId: null });
    expect(mk(db, b, { name: "Bravo New" })).toBeTruthy();
  });
});

describe("tournament entry helpers", () => {
  it("resolveTeamEntry: must be a member and the game must match", () => {
    const { db, ids: [a, b] } = setup();
    const t = mk(db, a);
    expect(resolveTeamEntry(db, a, t, "g_ff")).toEqual({ id: t, name: "Alpha Squad" });
    expect(code(() => resolveTeamEntry(db, a, t, "g_bgmi"))).toBe("TEAM_GAME_MISMATCH");
    expect(code(() => resolveTeamEntry(db, b, t, "g_ff"))).toBe("TEAM_NOT_FOUND");
    updateMyDetails(db, a, t, { ign: "Alpha", gameUid: "123456789" });
    expect(teamsForGame(db, a, "g_ff")).toEqual([{ id: t, name: "Alpha Squad", tag: "ALP", ign: "Alpha", gameUid: "123456789" }]);
    expect(teamsForGame(db, a, "g_bgmi")).toEqual([]);
  });
});
