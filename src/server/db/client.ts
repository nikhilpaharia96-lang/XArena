import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { buildLayout, firstFreePosition, slotKey } from "@/lib/slot-layout";

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
  if (!tournamentCols.some((c) => c.name === "slotSelection")) {
    db.exec("ALTER TABLE Tournament ADD COLUMN slotSelection INTEGER NOT NULL DEFAULT 1");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_tournament_category ON Tournament(category)");

  // Slot/position registration columns (older DB files won't have them yet).
  const partCols = db.prepare("PRAGMA table_info(TournamentParticipant)").all() as { name: string }[];
  for (const col of ["slotNumber INTEGER", "position INTEGER", "ign TEXT", "gameUid TEXT"]) {
    if (!partCols.some((c) => c.name === col.split(" ")[0])) db.exec(`ALTER TABLE TournamentParticipant ADD COLUMN ${col}`);
  }
  // The DB-level guarantee that a slot position can never be taken twice.
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_slot ON TournamentParticipant(tournamentId, slotNumber, position) WHERE slotNumber IS NOT NULL"
  );
  backfillSlots(db);

  return db;
}

/**
 * One-time, idempotent backfill: registrations made before slot selection existed get the
 * next free position (in join order) so admin and player views agree on who sits where.
 */
function backfillSlots(db: Database.Database) {
  const pending = db
    .prepare(
      `SELECT tp.id, tp.tournamentId, t.mode, t.roomSize, t.maxSlots
       FROM TournamentParticipant tp JOIN Tournament t ON t.id = tp.tournamentId
       WHERE tp.slotNumber IS NULL ORDER BY tp.tournamentId, tp.joinedAt ASC`
    )
    .all() as { id: string; tournamentId: string; mode: string; roomSize: number; maxSlots: number }[];
  if (pending.length === 0) return;

  const assign = db.transaction(() => {
    const takenByTournament = new Map<string, Set<string>>();
    const taken = (tid: string) => {
      if (!takenByTournament.has(tid)) {
        const rows = db
          .prepare("SELECT slotNumber, position FROM TournamentParticipant WHERE tournamentId = ? AND slotNumber IS NOT NULL")
          .all(tid) as { slotNumber: number; position: number }[];
        takenByTournament.set(tid, new Set(rows.map((r) => slotKey(r.slotNumber, r.position))));
      }
      return takenByTournament.get(tid)!;
    };
    for (const row of pending) {
      const set = taken(row.tournamentId);
      const spot = firstFreePosition(buildLayout(row.mode, row.roomSize, row.maxSlots), set, new Set());
      if (!spot) continue; // more registrations than positions: leave unassigned for an admin to fix
      db.prepare("UPDATE TournamentParticipant SET slotNumber = ?, position = ? WHERE id = ?").run(spot.slotNumber, spot.position, row.id);
      set.add(slotKey(spot.slotNumber, spot.position));
    }
  });
  assign();
}

export const db = global.__xarenaDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  global.__xarenaDb = db;
}
