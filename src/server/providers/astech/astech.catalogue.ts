import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import { createLogger } from "../logger";
import { PROVIDER_ID } from "./astech.config";
import type { AsTechClient } from "./astech.client";
import { AsTechError } from "./astech.errors";
import type { AsTechCurrency, AsTechGame, AsTechGamesFilter } from "./astech.types";

const log = createLogger("astech.catalogue");

const SYNC_KEY = "astech.sync";
const CURRENCIES_KEY = "astech.currencies";

/** Documented shape: content = { count, games: [{ gameId, title, provider, category, imageUrl, currencies }] } */
export function parseGames(content: unknown): { games: AsTechGame[]; skipped: number } {
  const list = (content as { games?: unknown } | null)?.games;
  if (!Array.isArray(list)) throw new AsTechError("INVALID_RESPONSE", "Games response has no games array");
  const games: AsTechGame[] = [];
  let skipped = 0;
  for (const item of list) {
    const g = item as Record<string, unknown>;
    const gameId = typeof g?.gameId === "string" ? g.gameId.trim() : "";
    const title = typeof g?.title === "string" ? g.title.trim() : "";
    if (!gameId || !title) {
      skipped += 1;
      continue;
    }
    games.push({
      gameId,
      title,
      provider: typeof g.provider === "string" && g.provider ? g.provider : "Unknown",
      category: typeof g.category === "string" && g.category ? g.category : "other",
      imageUrl: typeof g.imageUrl === "string" && /^https?:\/\//i.test(g.imageUrl) ? g.imageUrl : null,
      currencies: Array.isArray(g.currencies)
        ? g.currencies.filter((c): c is string => typeof c === "string").map((c) => c.toUpperCase())
        : [],
    });
  }
  return { games, skipped };
}

/** Documented shape: content = { count, currencies: [{ code, name, symbol, decimals }] } */
export function parseCurrencies(content: unknown): AsTechCurrency[] {
  const list = (content as { currencies?: unknown } | null)?.currencies;
  if (!Array.isArray(list)) throw new AsTechError("INVALID_RESPONSE", "Currencies response has no currencies array");
  return list
    .map((c) => c as Record<string, unknown>)
    .filter((c) => typeof c?.code === "string")
    .map((c) => ({
      code: (c.code as string).toUpperCase(),
      name: typeof c.name === "string" ? c.name : undefined,
      symbol: typeof c.symbol === "string" ? c.symbol : undefined,
      decimals: typeof c.decimals === "number" ? c.decimals : undefined,
    }));
}

export async function fetchCurrencies(client: AsTechClient): Promise<AsTechCurrency[]> {
  const res = await client.post("/api/public/v1/currencies", {});
  return parseCurrencies(res.data);
}

export async function fetchGames(client: AsTechClient, filter: AsTechGamesFilter = {}) {
  const res = await client.post("/api/public/v1/games", filter);
  return parseGames(res.data);
}

export interface SyncState {
  at: string;
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  markedUnavailable: number;
  skipped: number;
  error?: string;
}

function putSetting(db: Database.Database, key: string, value: unknown) {
  db.prepare(
    `INSERT INTO Setting (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  ).run(key, JSON.stringify(value), new Date().toISOString());
}

function getSetting<T>(db: Database.Database, key: string): T | null {
  const row = db.prepare("SELECT value FROM Setting WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export const getSyncState = (db: Database.Database) => getSetting<SyncState>(db, SYNC_KEY);
export const getStoredCurrencies = (db: Database.Database) => getSetting<AsTechCurrency[]>(db, CURRENCIES_KEY) ?? [];

/** Upsert catalogue rows. Admin's isEnabled choice is never overwritten by a sync. */
export function upsertGames(db: Database.Database, games: AsTechGame[], skipped = 0): SyncState {
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  const run = db.transaction(() => {
    const find = db.prepare("SELECT id FROM ProviderGame WHERE provider = ? AND providerGameId = ?");
    const insert = db.prepare(
      `INSERT INTO ProviderGame (id, provider, providerGameId, title, providerName, category, imageUrl, currencies,
                                 isEnabled, isAvailable, raw, lastSyncedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`
    );
    const update = db.prepare(
      `UPDATE ProviderGame SET title = ?, providerName = ?, category = ?, imageUrl = ?, currencies = ?,
              isAvailable = 1, raw = ?, lastSyncedAt = ?, updatedAt = ? WHERE id = ?`
    );
    for (const g of games) {
      const raw = JSON.stringify(g);
      const existing = find.get(PROVIDER_ID, g.gameId) as { id: string } | undefined;
      if (existing) {
        update.run(g.title, g.provider, g.category, g.imageUrl, JSON.stringify(g.currencies), raw, now, now, existing.id);
        updated += 1;
      } else {
        insert.run(createId("pg"), PROVIDER_ID, g.gameId, g.title, g.provider, g.category, g.imageUrl, JSON.stringify(g.currencies), raw, now, now, now);
        created += 1;
      }
    }
    // Games no longer returned by the provider are hidden, not deleted (history/FKs stay intact).
    const res = db
      .prepare("UPDATE ProviderGame SET isAvailable = 0, updatedAt = ? WHERE provider = ? AND lastSyncedAt < ? AND isAvailable = 1")
      .run(now, PROVIDER_ID, now);
    return res.changes;
  });
  const markedUnavailable = run();

  return { at: now, ok: true, total: games.length, created, updated, markedUnavailable, skipped };
}

let inFlight: Promise<SyncState> | null = null;

/** Single-flight sync: concurrent callers share one provider request (protects the 120 req/min limit). */
export function syncCatalogue(db: Database.Database, client: AsTechClient): Promise<SyncState> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const currencies = await fetchCurrencies(client);
      putSetting(db, CURRENCIES_KEY, currencies);
      const { games, skipped } = await fetchGames(client);
      // Guard against a bad/empty response wiping the whole catalogue.
      if (games.length === 0 && skipped === 0) {
        throw new AsTechError("INVALID_RESPONSE", "Provider returned an empty catalogue; keeping existing games");
      }
      const state = upsertGames(db, games, skipped);
      putSetting(db, SYNC_KEY, state);
      log.info("sync_ok", { ...state });
      return state;
    } catch (e) {
      const state: SyncState = {
        at: new Date().toISOString(),
        ok: false,
        total: 0,
        created: 0,
        updated: 0,
        markedUnavailable: 0,
        skipped: 0,
        error: e instanceof Error ? e.message.slice(0, 300) : "Sync failed",
      };
      putSetting(db, SYNC_KEY, state);
      log.error("sync_failed", { error: state.error });
      throw e;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function supportsCurrency(game: { currencies: string }, code: string): boolean {
  try {
    const list = JSON.parse(game.currencies) as string[];
    return list.map((c) => c.toUpperCase()).includes(code.toUpperCase());
  } catch {
    return false;
  }
}
