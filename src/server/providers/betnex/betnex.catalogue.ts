import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import { createLogger } from "../logger";
import { BetnexClient, BetnexError } from "./betnex.client";
import { PROVIDER_ID, WALLET_CURRENCY } from "./betnex.config";

const log = createLogger("betnex.catalogue");
const SYNC_KEY = "betnex.sync";

export interface BetnexGame {
  gameId: string; // game_uid — passed as gameId to /getgameurl
  title: string;
  providerCode: string;
  providerName: string;
  category: string;
  imageUrl: string | null;
}

interface ProviderEntry {
  code: string;
  name: string;
}

const csv = (v: unknown): string[] =>
  typeof v === "string" ? v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];

/** GET /filterproviders → only providers that are active (status 1) and support INR. */
export function parseProviders(json: unknown): ProviderEntry[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new BetnexError("INVALID_RESPONSE", "filterproviders returned no data array");
  const out: ProviderEntry[] = [];
  for (const p of data as Record<string, unknown>[]) {
    const code = typeof p?.code === "string" ? p.code.trim() : "";
    if (!code || p.status !== 1 || !csv(p.currency).includes(WALLET_CURRENCY)) continue;
    out.push({ code, name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : code });
  }
  return out;
}

/** GET /filtergames → only games with status 1 for INR (the doc: never render status 0). */
export function parseGames(json: unknown, provider: ProviderEntry): { games: BetnexGame[]; skipped: number } {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) throw new BetnexError("INVALID_RESPONSE", "filtergames returned no data array");
  const games: BetnexGame[] = [];
  let skipped = 0;
  for (const g of data as Record<string, unknown>[]) {
    const gameId = typeof g?.game_uid === "string" ? g.game_uid.trim() : "";
    const title = typeof g?.game_name === "string" ? g.game_name.trim() : "";
    if (!gameId || !title) {
      skipped += 1;
      continue;
    }
    if (g.status !== 1 || !csv(g.currency).includes(WALLET_CURRENCY)) continue;
    games.push({
      gameId,
      title,
      providerCode: provider.code,
      providerName: provider.name,
      category: typeof g.game_type === "string" && g.game_type.trim() ? g.game_type.trim().toLowerCase() : "other",
      imageUrl: null,
    });
  }
  return { games, skipped };
}

/** GET /getallgamesandprovider → thumbnails keyed by game id (best effort; the filter API has no images). */
export function parseImages(json: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const list = (json as { games?: unknown } | null)?.games;
  if (!Array.isArray(list)) return map;
  for (const g of list as Record<string, unknown>[]) {
    if (typeof g?.id === "string" && typeof g.img === "string" && /^https?:\/\//i.test(g.img)) map.set(g.id, g.img);
  }
  return map;
}

export interface SyncState {
  at: string;
  ok: boolean;
  providers: number;
  failedProviders: number;
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

export function getSyncState(db: Database.Database): SyncState | null {
  const row = db.prepare("SELECT value FROM Setting WHERE key = ?").get(SYNC_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SyncState;
  } catch {
    return null;
  }
}

/**
 * Upsert. A new game starts DISABLED (BETNEX has ~17,500 titles — the admin opts in per provider/category), an admin's
 * enable/disable choice is never overwritten by a sync, and games a provider stopped offering are marked unavailable —
 * but only for providers whose game list we actually fetched this time.
 */
export function upsertGames(
  db: Database.Database,
  games: BetnexGame[],
  fetchedProviderNames: Set<string>,
  meta: { providers: number; failedProviders: number; skipped: number }
): SyncState {
  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let markedUnavailable = 0;

  db.transaction(() => {
    const find = db.prepare("SELECT id FROM ProviderGame WHERE provider = ? AND providerGameId = ?");
    const insert = db.prepare(
      `INSERT INTO ProviderGame (id, provider, providerGameId, title, providerName, category, imageUrl, currencies,
                                 isEnabled, isAvailable, raw, lastSyncedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`
    );
    const update = db.prepare(
      `UPDATE ProviderGame SET title = ?, providerName = ?, category = ?, imageUrl = COALESCE(?, imageUrl), currencies = ?,
              isAvailable = 1, raw = ?, lastSyncedAt = ?, updatedAt = ? WHERE id = ?`
    );
    const seen = new Set<string>();
    const currencies = JSON.stringify([WALLET_CURRENCY]);
    for (const g of games) {
      seen.add(g.gameId);
      const raw = JSON.stringify({ providerCode: g.providerCode });
      const existing = find.get(PROVIDER_ID, g.gameId) as { id: string } | undefined;
      if (existing) {
        update.run(g.title, g.providerName, g.category, g.imageUrl, currencies, raw, now, now, existing.id);
        updated += 1;
      } else {
        insert.run(createId("pg"), PROVIDER_ID, g.gameId, g.title, g.providerName, g.category, g.imageUrl, currencies, raw, now, now, now);
        created += 1;
      }
    }

    const current = db
      .prepare("SELECT id, providerGameId, providerName FROM ProviderGame WHERE provider = ? AND isAvailable = 1")
      .all(PROVIDER_ID) as { id: string; providerGameId: string; providerName: string }[];
    const mark = db.prepare("UPDATE ProviderGame SET isAvailable = 0, updatedAt = ? WHERE id = ?");
    for (const row of current) {
      if (!seen.has(row.providerGameId) && fetchedProviderNames.has(row.providerName)) {
        mark.run(now, row.id);
        markedUnavailable += 1;
      }
    }
  })();

  const state: SyncState = { at: now, ok: true, total: games.length, created, updated, markedUnavailable, ...meta };
  putSetting(db, SYNC_KEY, state);
  return state;
}

let inFlight: Promise<SyncState> | null = null;

/** Single-flight sync: a full sync is ~2 requests per provider, so concurrent callers share one run. */
export function syncCatalogue(db: Database.Database, client: BetnexClient): Promise<SyncState> {
  if (inFlight) return inFlight;
  inFlight = doSync(db, client).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

async function doSync(db: Database.Database, client: BetnexClient): Promise<SyncState> {
  const base = { at: new Date().toISOString(), ok: false, providers: 0, failedProviders: 0, total: 0, created: 0, updated: 0, markedUnavailable: 0, skipped: 0 };
  try {
    const providers = parseProviders(await client.get("/filterproviders", { currency: WALLET_CURRENCY }));

    const all: BetnexGame[] = [];
    const fetched = new Set<string>();
    let failed = 0;
    let skipped = 0;

    await mapLimit(providers, 3, async (p) => {
      try {
        const res = parseGames(await client.get("/filtergames", { providercode: p.code, currency: WALLET_CURRENCY }), p);
        skipped += res.skipped;

        // Thumbnails are optional: a failure here must never fail the sync.
        try {
          const images = parseImages(await client.get("/getallgamesandprovider", { provider: p.code }));
          for (const g of res.games) g.imageUrl = images.get(g.gameId) ?? null;
        } catch {
          /* no thumbnails for this provider */
        }

        all.push(...res.games);
        fetched.add(p.name);
      } catch (e) {
        failed += 1;
        log.warn("provider_games_failed", { provider: p.code, kind: e instanceof BetnexError ? e.kind : "UNKNOWN" });
      }
    });

    // If everything failed, keep the existing catalogue untouched.
    if (providers.length > 0 && failed === providers.length) throw new BetnexError("NETWORK", "No provider's games could be fetched");

    return upsertGames(db, all, fetched, { providers: providers.length, failedProviders: failed, skipped });
  } catch (e) {
    const state: SyncState = { ...base, error: e instanceof BetnexError ? `${e.kind}: ${e.message}` : "Sync failed" };
    putSetting(db, SYNC_KEY, state);
    throw e;
  }
}
