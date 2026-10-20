import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createProviderWallet } from "../provider-wallet";
import { toPlayerLogin } from "../player-identity";

export const SECRET = "test-secret-key";
export const API_KEY = "test-api-key";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "src/server/db/schema.sql"), "utf-8");

export function makeDb(file?: string): Database.Database {
  const db = new Database(file ?? ":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function tempDbFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "xa-")), "t.db");
}

export interface Seed {
  userId: string;
  uid: string;
  login: string;
}

/** Create a user + wallet. Balances are integer paise. */
export function seedUser(
  db: Database.Database,
  opts: { deposit?: number; winning?: number; bonus?: number; locked?: number; status?: string; n?: number } = {}
): Seed {
  const n = opts.n ?? 1;
  const userId = `user_${n}`;
  const uid = `uid_${n}`;
  db.prepare(
    `INSERT INTO User (id, uid, email, passwordHash, authProvider, username, role, status, referralCode, createdAt, updatedAt)
     VALUES (?, ?, ?, 'x', 'EMAIL', ?, 'USER', ?, ?, ?, ?)`
  ).run(userId, uid, `u${n}@x.test`, `user${n}`, opts.status ?? "ACTIVE", `REF${n}`, new Date().toISOString(), new Date().toISOString());
  db.prepare(
    `INSERT INTO Wallet (id, userId, depositBalance, winningBalance, bonusBalance, lockedBalance, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(`w_${n}`, userId, opts.deposit ?? 0, opts.winning ?? 0, opts.bonus ?? 0, opts.locked ?? 0, new Date().toISOString());
  return { userId, uid, login: toPlayerLogin(uid) };
}

export function walletOf(db: Database.Database, userId: string) {
  return db.prepare("SELECT depositBalance AS deposit, winningBalance AS winning, bonusBalance AS bonus, lockedBalance AS locked FROM Wallet WHERE userId = ?").get(userId) as {
    deposit: number;
    winning: number;
    bonus: number;
    locked: number;
  };
}

export const wallet = (db: Database.Database) => createProviderWallet(db);
