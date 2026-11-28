import { db } from "@/server/db/client";
import { createLogger } from "../logger";
import { getSyncState, syncCatalogue } from "./betnex.catalogue";
import { isBetnexConfigured } from "./betnex.config";
import { createRuntimeClient } from "./betnex.runtime";

const log = createLogger("betnex.refresh");

// BETNEX: "cache the provider list and game catalogues; refresh once per day".
const TTL_MS = Math.max(60, Number(process.env.BETNEX_CATALOGUE_TTL_MINUTES) || 1440) * 60_000;
const FAILURE_BACKOFF_MS = 30 * 60_000;

/** Called from the user-facing catalogue route: at most one background sync per TTL, never blocks the response. */
export function refreshBetnexCatalogueIfStale(): void {
  if (!isBetnexConfigured()) return;
  const last = getSyncState(db);
  const age = last ? Date.now() - new Date(last.at).getTime() : Infinity;
  const due = last?.ok ? age > TTL_MS : age > FAILURE_BACKOFF_MS;
  if (!due) return;
  syncCatalogue(db, createRuntimeClient()).catch((e) => log.warn("background_sync_failed", { message: e instanceof Error ? e.message : "unknown" }));
}
