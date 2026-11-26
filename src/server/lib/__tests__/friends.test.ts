import { describe, expect, it } from "vitest";
import { makeDb, seedUser } from "@/server/providers/__tests__/helpers";
import {
  badgeCounts, getMessages, listFriends, listRequests, removeFriendship, respondToRequest,
  searchUsers, sendFriendRequest, sendMessage,
} from "../friends";

function setup() {
  const db = makeDb();
  const a = seedUser(db, { n: 1 }).userId;
  const b = seedUser(db, { n: 2 }).userId;
  const c = seedUser(db, { n: 3 }).userId;
  return { db, a, b, c };
}
const befriend = (db: ReturnType<typeof makeDb>, from: string, to: string) => {
  const r = sendFriendRequest(db, from, to);
  respondToRequest(db, to, r.friendshipId, true);
  return r.friendshipId;
};
const err = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as { code?: string }).code; } return "NO_ERROR"; };

describe("friend requests", () => {
  it("sends, lists and accepts a request, notifying the other side", () => {
    const { db, a, b } = setup();
    const r = sendFriendRequest(db, a, b);
    expect(r.status).toBe("PENDING");
    expect(listRequests(db, b).incoming.map((x) => x.user.id)).toEqual([a]);
    expect(listRequests(db, a).outgoing.map((x) => x.user.id)).toEqual([b]);
    expect(badgeCounts(db, b).pendingRequests).toBe(1);

    respondToRequest(db, b, r.friendshipId, true);
    expect(listFriends(db, a).map((f) => f.user.id)).toEqual([b]);
    expect(listFriends(db, b).map((f) => f.user.id)).toEqual([a]);
    const types = db.prepare("SELECT userId, type FROM Notification ORDER BY createdAt").all();
    expect(types).toEqual(expect.arrayContaining([{ userId: b, type: "FRIEND_REQUEST" }, { userId: a, type: "FRIEND_ACCEPTED" }]));
  });

  it("blocks self, duplicates, and unknown/inactive users", () => {
    const { db, a, b } = setup();
    expect(err(() => sendFriendRequest(db, a, a))).toBe("SELF_REQUEST");
    expect(err(() => sendFriendRequest(db, a, "nobody"))).toBe("USER_NOT_FOUND");
    db.prepare("UPDATE User SET status = 'BANNED' WHERE id = ?").run(b);
    expect(err(() => sendFriendRequest(db, a, b))).toBe("USER_NOT_FOUND");
    db.prepare("UPDATE User SET status = 'ACTIVE' WHERE id = ?").run(b);
    sendFriendRequest(db, a, b);
    expect(err(() => sendFriendRequest(db, a, b))).toBe("ALREADY_REQUESTED");
  });

  it("treats a crossing request as acceptance", () => {
    const { db, a, b } = setup();
    sendFriendRequest(db, a, b);
    expect(sendFriendRequest(db, b, a).status).toBe("ACCEPTED");
    expect(err(() => sendFriendRequest(db, a, b))).toBe("ALREADY_FRIENDS");
    expect(db.prepare("SELECT COUNT(*) AS n FROM Friendship").get()).toEqual({ n: 1 });
  });

  it("only the receiver can accept/decline; decline deletes the row and allows re-request", () => {
    const { db, a, b, c } = setup();
    const r = sendFriendRequest(db, a, b);
    expect(err(() => respondToRequest(db, a, r.friendshipId, true))).toBe("REQUEST_NOT_FOUND");
    expect(err(() => respondToRequest(db, c, r.friendshipId, true))).toBe("REQUEST_NOT_FOUND");
    respondToRequest(db, b, r.friendshipId, false);
    expect(listRequests(db, b).incoming).toHaveLength(0);
    expect(sendFriendRequest(db, a, b).status).toBe("PENDING");
  });

  it("removing a friend deletes the chat; strangers can't remove it", () => {
    const { db, a, b, c } = setup();
    const f = befriend(db, a, b);
    sendMessage(db, a, f, "hi");
    expect(err(() => removeFriendship(db, c, f))).toBe("FRIEND_NOT_FOUND");
    removeFriendship(db, b, f);
    expect(listFriends(db, a)).toHaveLength(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM DirectMessage").get()).toEqual({ n: 0 });
  });
});

describe("search", () => {
  it("finds by username or uid, excludes self, hides email, escapes wildcards, shows relation", () => {
    const { db, a, b } = setup();
    expect(searchUsers(db, a, "user")).toHaveLength(2); // user2, user3 — not self
    expect(searchUsers(db, a, "u")).toEqual([]); // too short
    expect(searchUsers(db, a, "%%")).toEqual([]);
    expect(searchUsers(db, a, "uid_2").map((u) => u.id)).toEqual([b]);
    expect(Object.keys(searchUsers(db, a, "user2")[0])).not.toContain("email");
    sendFriendRequest(db, a, b);
    expect(searchUsers(db, a, "user2")[0].relation).toBe("REQUEST_SENT");
    expect(searchUsers(db, b, "user1")[0].relation).toBe("REQUEST_RECEIVED");
  });
});

describe("chat", () => {
  it("only friends can chat, only participants can read", () => {
    const { db, a, b, c } = setup();
    const pending = sendFriendRequest(db, a, b).friendshipId;
    expect(err(() => sendMessage(db, a, pending, "hello"))).toBe("CONVERSATION_NOT_FOUND");
    respondToRequest(db, b, pending, true);
    sendMessage(db, a, pending, "hello");
    expect(err(() => getMessages(db, c, pending))).toBe("CONVERSATION_NOT_FOUND");
    expect(err(() => sendMessage(db, c, pending, "intruder"))).toBe("CONVERSATION_NOT_FOUND");
  });

  it("validates messages: trims, rejects empty and over-long", () => {
    const { db, a, b } = setup();
    const f = befriend(db, a, b);
    expect(sendMessage(db, a, f, "  hey  ").body).toBe("hey");
    expect(err(() => sendMessage(db, a, f, "   "))).toBe("EMPTY_MESSAGE");
    expect(err(() => sendMessage(db, a, f, "x".repeat(1001)))).toBe("MESSAGE_TOO_LONG");
    expect(sendMessage(db, a, f, "x".repeat(1000)).body).toHaveLength(1000);
  });

  it("tracks unread, marks read when the other side opens it, orders the list by activity", () => {
    const { db, a, b, c } = setup();
    const ab = befriend(db, a, b);
    const ac = befriend(db, a, c);
    sendMessage(db, b, ab, "one", new Date("2026-11-26T10:00:00Z"));
    sendMessage(db, b, ab, "two", new Date("2026-11-26T10:01:00Z"));
    sendMessage(db, c, ac, "yo", new Date("2026-11-26T11:00:00Z"));

    expect(badgeCounts(db, a).unreadMessages).toBe(3);
    const list = listFriends(db, a);
    expect(list.map((f) => f.user.id)).toEqual([c, b]); // most recent activity first
    expect(list[1]).toMatchObject({ unread: 2, lastMessage: { body: "two", senderId: b } });

    // sender's own view must not clear what *they* haven't read, nor peeking with markRead:false
    getMessages(db, a, ab, { markRead: false });
    expect(badgeCounts(db, a).unreadMessages).toBe(3);
    const res = getMessages(db, a, ab);
    expect(res.messages.map((m) => m.body)).toEqual(["one", "two"]);
    expect(badgeCounts(db, a).unreadMessages).toBe(1);
    // b sent those messages, so b has nothing unread
    expect(badgeCounts(db, b).unreadMessages).toBe(0);
  });

  it("stores messages as plain text (no HTML interpretation server-side)", () => {
    const { db, a, b } = setup();
    const f = befriend(db, a, b);
    expect(sendMessage(db, a, f, "<img src=x onerror=alert(1)>").body).toBe("<img src=x onerror=alert(1)>");
  });
});
