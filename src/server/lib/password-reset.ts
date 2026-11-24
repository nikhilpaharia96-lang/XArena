import type Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { createId } from "./ids";
import { phoneLoginCandidates } from "@/lib/phone";

/** A reset link is valid for 30 minutes and works once. */
export const RESET_TTL_MS = 30 * 60_000;
export const RESET_TICKET_SUBJECT = "Password reset request";

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface ResetUser {
  id: string;
  email: string;
  username: string;
  status: string;
}

/** Same lookup rules as login: email, or phone in any accepted format. */
export function findUserByIdentifier(db: Database.Database, identifier: string): ResetUser | undefined {
  const cols = "id, email, username, status";
  if (identifier.includes("@")) {
    return db.prepare(`SELECT ${cols} FROM User WHERE email = ?`).get(identifier.toLowerCase()) as ResetUser | undefined;
  }
  for (const phone of phoneLoginCandidates(identifier)) {
    const u = db.prepare(`SELECT ${cols} FROM User WHERE phone = ?`).get(phone) as ResetUser | undefined;
    if (u) return u;
  }
  return undefined;
}

/** Banned accounts don't get self-service resets. */
export const canSelfReset = (u: ResetUser) => u.status !== "BANNED";

/**
 * Creates a fresh single-use token and invalidates any earlier unused ones, so
 * only the newest emailed link works. Returns the RAW token (for the email);
 * only its hash is stored.
 */
export function createResetToken(db: Database.Database, userId: string, now = new Date()): string {
  const token = randomBytes(32).toString("base64url");
  const nowIso = now.toISOString();
  db.transaction(() => {
    db.prepare("UPDATE PasswordResetToken SET usedAt = ? WHERE userId = ? AND usedAt IS NULL").run(nowIso, userId);
    db.prepare(
      "INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)"
    ).run(createId("prt"), userId, hashResetToken(token), new Date(now.getTime() + RESET_TTL_MS).toISOString(), nowIso);
  })();
  return token;
}

/** True when the token exists, is unused and not expired (no side effects). */
export function isResetTokenValid(db: Database.Database, token: string, now = new Date()): boolean {
  const row = db
    .prepare("SELECT 1 FROM PasswordResetToken WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?")
    .get(hashResetToken(token), now.toISOString());
  return !!row;
}

/**
 * Atomically: validates the token, sets the new password hash, marks the token
 * used and signs the user out everywhere. Returns the user id, or null if the
 * token is unknown, used or expired.
 */
export function consumeResetToken(
  db: Database.Database,
  token: string,
  newPasswordHash: string,
  now = new Date()
): string | null {
  const nowIso = now.toISOString();
  return db.transaction(() => {
    const row = db
      .prepare("SELECT id, userId FROM PasswordResetToken WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ?")
      .get(hashResetToken(token), nowIso) as { id: string; userId: string } | undefined;
    if (!row) return null;
    // Mark used first; if two requests race, only one can change a row.
    const used = db.prepare("UPDATE PasswordResetToken SET usedAt = ? WHERE id = ? AND usedAt IS NULL").run(nowIso, row.id);
    if (used.changes !== 1) return null;
    db.prepare("UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?").run(newPasswordHash, nowIso, row.userId);
    db.prepare("UPDATE Session SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run(nowIso, row.userId);
    return row.userId;
  })();
}

/**
 * Fallback when email isn't configured: open a support ticket for the admin
 * team (who can then use Admin > Users > Reset password). At most one open
 * request per user per 24h so it can't be used to spam the queue.
 * Returns true if a new ticket was created.
 */
export function createResetTicketOnce(db: Database.Database, user: ResetUser, identifier: string, now = new Date()): boolean {
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const existing = db
    .prepare("SELECT 1 FROM SupportTicket WHERE userId = ? AND subject = ? AND status = 'OPEN' AND createdAt > ?")
    .get(user.id, RESET_TICKET_SUBJECT, since);
  if (existing) return false;
  const nowIso = now.toISOString();
  db.prepare(
    `INSERT INTO SupportTicket (id, userId, subject, message, status, priority, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'OPEN', 'HIGH', ?, ?)`
  ).run(
    createId("tkt"),
    user.id,
    RESET_TICKET_SUBJECT,
    `Player @${user.username} asked to reset their password (entered: ${identifier}). Verify it is really them, then use Admin > Users > Reset password and share the temporary password privately.`,
    nowIso,
    nowIso
  );
  return true;
}
