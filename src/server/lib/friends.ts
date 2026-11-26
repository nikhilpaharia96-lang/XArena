import type Database from "better-sqlite3";
import { ApiError } from "./api-response";
import { createId } from "./ids";

/**
 * Friends + 1:1 chat. Every function takes the database explicitly (and never touches the
 * global connection) so it is unit-testable against an in-memory DB. All authorisation is
 * done here: callers pass the authenticated user id and nothing else is trusted.
 */

export const MESSAGE_MAX_LENGTH = 1000;
export const SEARCH_MIN_LENGTH = 2;

type Db = Database.Database;

export type Relation = "NONE" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendItem {
  friendshipId: string;
  user: PublicUser;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unread: number;
  lastActivityAt: string;
}

export interface RequestItem {
  friendshipId: string;
  user: PublicUser;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export const pairKeyOf = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

interface FriendshipRow {
  id: string;
  pairKey: string;
  requesterId: string;
  addresseeId: string;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
}

function getFriendship(db: Db, id: string): FriendshipRow | undefined {
  return db.prepare("SELECT * FROM Friendship WHERE id = ?").get(id) as FriendshipRow | undefined;
}

function notify(db: Db, userId: string, type: string, title: string, body: string, data: unknown, now: string) {
  db.prepare(
    `INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(createId("notif"), userId, type, title, body, JSON.stringify(data), now);
}

const nameOf = (db: Db, userId: string) =>
  (db.prepare("SELECT username FROM User WHERE id = ?").get(userId) as { username: string } | undefined)?.username ?? "Someone";

/** Escapes LIKE wildcards so a search for "_" or "%" can't match every user. */
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function searchUsers(db: Db, meId: string, rawQuery: string): (PublicUser & { relation: Relation; friendshipId: string | null })[] {
  const q = rawQuery.trim().replace(/^@/, "");
  if (q.length < SEARCH_MIN_LENGTH) return [];

  const rows = db
    .prepare(
      `SELECT id, username, displayName, avatarUrl FROM User
       WHERE id <> ? AND status = 'ACTIVE' AND (username LIKE ? ESCAPE '\\' OR uid = ?)
       ORDER BY (lower(username) = lower(?)) DESC, username LIMIT 10`
    )
    .all(meId, likePattern(q), q, q) as PublicUser[];

  return rows.map((u) => {
    const f = db.prepare("SELECT id, requesterId, status FROM Friendship WHERE pairKey = ?").get(pairKeyOf(meId, u.id)) as
      | { id: string; requesterId: string; status: string }
      | undefined;
    let relation: Relation = "NONE";
    if (f) relation = f.status === "ACCEPTED" ? "FRIENDS" : f.requesterId === meId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
    return { ...u, relation, friendshipId: f?.id ?? null };
  });
}

/**
 * Sends a friend request. If the other person already asked *you*, that is treated as accepting
 * (otherwise two people adding each other at the same time would deadlock on "already pending").
 */
export function sendFriendRequest(db: Db, meId: string, targetId: string, now = new Date()): { friendshipId: string; status: "PENDING" | "ACCEPTED" } {
  if (meId === targetId) throw new ApiError(400, "You can't add yourself.", "SELF_REQUEST");

  return db.transaction(() => {
    const target = db.prepare("SELECT id, status FROM User WHERE id = ?").get(targetId) as { id: string; status: string } | undefined;
    if (!target || target.status !== "ACTIVE") throw new ApiError(404, "Player not found.", "USER_NOT_FOUND");

    const iso = now.toISOString();
    const existing = db.prepare("SELECT * FROM Friendship WHERE pairKey = ?").get(pairKeyOf(meId, targetId)) as FriendshipRow | undefined;

    if (existing) {
      if (existing.status === "ACCEPTED") throw new ApiError(409, "You are already friends.", "ALREADY_FRIENDS");
      if (existing.requesterId === meId) throw new ApiError(409, "Friend request already sent.", "ALREADY_REQUESTED");
      db.prepare("UPDATE Friendship SET status = 'ACCEPTED', updatedAt = ? WHERE id = ?").run(iso, existing.id);
      notify(db, targetId, "FRIEND_ACCEPTED", "Friend request accepted", `${nameOf(db, meId)} is now your friend.`, { friendshipId: existing.id }, iso);
      return { friendshipId: existing.id, status: "ACCEPTED" as const };
    }

    const id = createId("frnd");
    db.prepare(
      `INSERT INTO Friendship (id, pairKey, requesterId, addresseeId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
    ).run(id, pairKeyOf(meId, targetId), meId, targetId, iso, iso);
    notify(db, targetId, "FRIEND_REQUEST", "New friend request", `${nameOf(db, meId)} sent you a friend request.`, { friendshipId: id }, iso);
    return { friendshipId: id, status: "PENDING" as const };
  })();
}

/** Only the person who *received* the request can accept or decline it. Declining deletes the row. */
export function respondToRequest(db: Db, meId: string, friendshipId: string, accept: boolean, now = new Date()) {
  return db.transaction(() => {
    const f = getFriendship(db, friendshipId);
    if (!f || f.status !== "PENDING" || f.addresseeId !== meId) {
      throw new ApiError(404, "Friend request not found.", "REQUEST_NOT_FOUND");
    }
    const iso = now.toISOString();
    if (accept) {
      db.prepare("UPDATE Friendship SET status = 'ACCEPTED', updatedAt = ? WHERE id = ?").run(iso, f.id);
      notify(db, f.requesterId, "FRIEND_ACCEPTED", "Friend request accepted", `${nameOf(db, meId)} accepted your friend request.`, { friendshipId: f.id }, iso);
    } else {
      db.prepare("DELETE FROM Friendship WHERE id = ?").run(f.id);
    }
    return { accepted: accept };
  })();
}

/** Either side can remove a friend or the sender can cancel a pending request. Deletes the chat too. */
export function removeFriendship(db: Db, meId: string, friendshipId: string) {
  const f = getFriendship(db, friendshipId);
  if (!f || (f.requesterId !== meId && f.addresseeId !== meId)) {
    throw new ApiError(404, "Friend not found.", "FRIEND_NOT_FOUND");
  }
  db.prepare("DELETE FROM Friendship WHERE id = ?").run(f.id);
}

export function listFriends(db: Db, meId: string): FriendItem[] {
  const rows = db
    .prepare(
      `SELECT f.id AS friendshipId, f.updatedAt,
              u.id, u.username, u.displayName, u.avatarUrl,
              (SELECT COUNT(*) FROM DirectMessage m WHERE m.friendshipId = f.id AND m.senderId <> ? AND m.readAt IS NULL) AS unread,
              (SELECT m.body FROM DirectMessage m WHERE m.friendshipId = f.id ORDER BY m.id DESC LIMIT 1) AS lastBody,
              (SELECT m.senderId FROM DirectMessage m WHERE m.friendshipId = f.id ORDER BY m.id DESC LIMIT 1) AS lastSender,
              (SELECT m.createdAt FROM DirectMessage m WHERE m.friendshipId = f.id ORDER BY m.id DESC LIMIT 1) AS lastAt
       FROM Friendship f
       JOIN User u ON u.id = CASE WHEN f.requesterId = ? THEN f.addresseeId ELSE f.requesterId END
       WHERE f.status = 'ACCEPTED' AND (f.requesterId = ? OR f.addresseeId = ?)`
    )
    .all(meId, meId, meId, meId) as {
    friendshipId: string; updatedAt: string; id: string; username: string; displayName: string | null; avatarUrl: string | null;
    unread: number; lastBody: string | null; lastSender: string | null; lastAt: string | null;
  }[];

  return rows
    .map((r) => ({
      friendshipId: r.friendshipId,
      user: { id: r.id, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
      lastMessage: r.lastBody && r.lastSender && r.lastAt ? { body: r.lastBody, senderId: r.lastSender, createdAt: r.lastAt } : null,
      unread: r.unread,
      lastActivityAt: r.lastAt ?? r.updatedAt,
    }))
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
}

export function listRequests(db: Db, meId: string): { incoming: RequestItem[]; outgoing: RequestItem[] } {
  const q = (col: "requesterId" | "addresseeId", other: "requesterId" | "addresseeId") =>
    (db
      .prepare(
        `SELECT f.id AS friendshipId, f.createdAt, u.id, u.username, u.displayName, u.avatarUrl
         FROM Friendship f JOIN User u ON u.id = f.${other}
         WHERE f.status = 'PENDING' AND f.${col} = ? ORDER BY f.createdAt DESC`
      )
      .all(meId) as { friendshipId: string; createdAt: string; id: string; username: string; displayName: string | null; avatarUrl: string | null }[]).map(
      (r): RequestItem => ({
        friendshipId: r.friendshipId,
        createdAt: r.createdAt,
        user: { id: r.id, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl },
      })
    );
  return { incoming: q("addresseeId", "requesterId"), outgoing: q("requesterId", "addresseeId") };
}

/** Total unread chat messages + incoming requests — for the badge. */
export function badgeCounts(db: Db, meId: string) {
  const unread = db
    .prepare(
      `SELECT COUNT(*) AS n FROM DirectMessage m JOIN Friendship f ON f.id = m.friendshipId
       WHERE f.status = 'ACCEPTED' AND (f.requesterId = ? OR f.addresseeId = ?) AND m.senderId <> ? AND m.readAt IS NULL`
    )
    .get(meId, meId, meId) as { n: number };
  const pending = db.prepare("SELECT COUNT(*) AS n FROM Friendship WHERE addresseeId = ? AND status = 'PENDING'").get(meId) as { n: number };
  return { unreadMessages: unread.n, pendingRequests: pending.n };
}

/** Resolves the conversation for a participant, or throws 404 (same error for "not yours" and "doesn't exist"). */
function requireConversation(db: Db, meId: string, friendshipId: string): FriendshipRow {
  const f = getFriendship(db, friendshipId);
  if (!f || f.status !== "ACCEPTED" || (f.requesterId !== meId && f.addresseeId !== meId)) {
    throw new ApiError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
  }
  return f;
}

/** Latest messages (oldest first). Fetching marks the other person's messages as read. */
export function getMessages(db: Db, meId: string, friendshipId: string, opts: { limit?: number; markRead?: boolean; now?: Date } = {}) {
  const f = requireConversation(db, meId, friendshipId);
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);

  if (opts.markRead !== false) {
    db.prepare("UPDATE DirectMessage SET readAt = ? WHERE friendshipId = ? AND senderId <> ? AND readAt IS NULL").run(
      (opts.now ?? new Date()).toISOString(),
      f.id,
      meId
    );
  }

  const messages = (
    db
      .prepare("SELECT id, senderId, body, createdAt, readAt FROM DirectMessage WHERE friendshipId = ? ORDER BY id DESC LIMIT ?")
      .all(f.id, limit) as ChatMessage[]
  ).reverse();

  const otherId = f.requesterId === meId ? f.addresseeId : f.requesterId;
  const other = db.prepare("SELECT id, username, displayName, avatarUrl FROM User WHERE id = ?").get(otherId) as PublicUser;
  return { friend: other, messages };
}

export function sendMessage(db: Db, meId: string, friendshipId: string, rawBody: string, now = new Date()): ChatMessage {
  const f = requireConversation(db, meId, friendshipId);
  const body = rawBody.replace(/\r\n/g, "\n").trim();
  if (!body) throw new ApiError(400, "Message can't be empty.", "EMPTY_MESSAGE");
  if (body.length > MESSAGE_MAX_LENGTH) {
    throw new ApiError(400, `Message is too long (max ${MESSAGE_MAX_LENGTH} characters).`, "MESSAGE_TOO_LONG");
  }
  const iso = now.toISOString();
  const res = db.prepare("INSERT INTO DirectMessage (friendshipId, senderId, body, createdAt) VALUES (?, ?, ?, ?)").run(f.id, meId, body, iso);
  db.prepare("UPDATE Friendship SET updatedAt = ? WHERE id = ?").run(iso, f.id);
  return { id: Number(res.lastInsertRowid), senderId: meId, body, createdAt: iso, readAt: null };
}
