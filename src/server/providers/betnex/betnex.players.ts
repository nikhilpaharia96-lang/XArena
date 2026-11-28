import type Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import type { BetnexConfig } from "./betnex.config";
import { PROVIDER_ID } from "./betnex.config";

/**
 * BETNEX needs a lowercase, ALPHANUMERIC-only username carrying our 2–3 character code, identical for every
 * session of a player. XArena's User.uid is base64url (mixed case, `-`/`_`), so it can't be used directly.
 * We give each user a random login once and store the mapping in ProviderPlayer; callbacks send it back as
 * `member_account`.
 */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 12;

function randomId(): string {
  let out = "";
  for (let i = 0; i < ID_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function composeLogin(id: string, cfg: Pick<BetnexConfig, "usernameCode" | "usernamePosition">): string {
  return cfg.usernamePosition === "suffix" ? `${id}${cfg.usernameCode}` : `${cfg.usernameCode}${id}`;
}

export function getOrCreateLogin(db: Database.Database, userId: string, cfg: Pick<BetnexConfig, "usernameCode" | "usernamePosition">): string {
  const existing = db.prepare("SELECT login FROM ProviderPlayer WHERE provider = ? AND userId = ?").get(PROVIDER_ID, userId) as { login: string } | undefined;
  if (existing) return existing.login;

  for (let attempt = 0; attempt < 5; attempt++) {
    const login = composeLogin(randomId(), cfg);
    try {
      db.prepare("INSERT INTO ProviderPlayer (provider, userId, login, createdAt) VALUES (?, ?, ?, ?)").run(PROVIDER_ID, userId, login, new Date().toISOString());
      return login;
    } catch (e) {
      // Another request created this user's login first → use it; otherwise the random login collided → retry.
      const again = db.prepare("SELECT login FROM ProviderPlayer WHERE provider = ? AND userId = ?").get(PROVIDER_ID, userId) as { login: string } | undefined;
      if (again) return again.login;
      if (!(e instanceof Error) || !e.message.includes("UNIQUE")) throw e;
    }
  }
  throw new Error("Could not allocate a provider login");
}

export interface BetnexUser {
  id: string;
  status: string;
}

export function findUserByLogin(db: Database.Database, memberAccount: string): BetnexUser | null {
  const login = memberAccount.trim().toLowerCase();
  if (!login || login.length > 64) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.status FROM ProviderPlayer p JOIN User u ON u.id = p.userId
       WHERE p.provider = ? AND p.login = ?`
    )
    .get(PROVIDER_ID, login) as BetnexUser | undefined;
  return row ?? null;
}
