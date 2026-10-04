import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// ----------------------------------------------------------------------------
// Local runtime DB connection (SQLite via better-sqlite3).
//
// Why this exists instead of Prisma Client at runtime: the schema in
// prisma/schema.prisma is the canonical, production-target data model
// (Postgres). This file is a thin, hand-rolled data-access layer used ONLY
// so the app runs end-to-end in environments where Prisma's engine
// binaries can't be downloaded. Query shapes here map directly onto what
// the Prisma-based NestJS services will do in the next milestone — same
// tables, same columns, same constraints (UNIQUE, FK, CASCADE).
// ----------------------------------------------------------------------------

declare global {
  var __xarenaDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const dbPath = path.join(process.cwd(), "data", "xarena.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schemaPath = path.join(process.cwd(), "src", "server", "db", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  // Lightweight in-place migrations for DB files created before a column existed
  // (CREATE TABLE IF NOT EXISTS won't add columns to an existing table).
  const tournamentCols = db.prepare("PRAGMA table_info(Tournament)").all() as { name: string }[];
  if (!tournamentCols.some((c) => c.name === "category")) {
    db.exec("ALTER TABLE Tournament ADD COLUMN category TEXT");
  }
  if (!tournamentCols.some((c) => c.name === "thumbnailUrl")) {
    db.exec("ALTER TABLE Tournament ADD COLUMN thumbnailUrl TEXT");
  }
  if (!tournamentCols.some((c) => c.name === "matchEndsAt")) {
    db.exec("ALTER TABLE Tournament ADD COLUMN matchEndsAt TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_tournament_category ON Tournament(category)");

  return db;
}

export const db = global.__xarenaDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  global.__xarenaDb = db;
}
