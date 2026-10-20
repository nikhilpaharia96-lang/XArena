import type Database from "better-sqlite3";

/**
 * Deterministic provider identity for an XArena user.
 *
 * We deliberately use User.uid (a separate unique opaque id) rather than the
 * primary key User.id, so the internal DB key is never handed to a third party,
 * while the mapping stays stable and reversible for callbacks.
 */
const PREFIX = "xa_";

export function toPlayerLogin(uid: string): string {
  return `${PREFIX}${uid}`;
}

export function uidFromPlayerLogin(playerLogin: string): string | null {
  if (!playerLogin.startsWith(PREFIX) || playerLogin.length <= PREFIX.length) return null;
  return playerLogin.slice(PREFIX.length);
}

export interface ProviderUser {
  id: string;
  uid: string;
  status: string;
}

export function findUserByPlayerLogin(db: Database.Database, playerLogin: string): ProviderUser | null {
  const uid = uidFromPlayerLogin(playerLogin);
  if (!uid) return null;
  const row = db.prepare("SELECT id, uid, status FROM User WHERE uid = ?").get(uid) as ProviderUser | undefined;
  return row ?? null;
}
