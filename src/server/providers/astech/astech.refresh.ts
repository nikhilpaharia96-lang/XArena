import { db } from "@/server/db/client";
import { createLogger } from "../logger";
import { getSyncState, syncCatalogue } from "./astech.catalogue";
import { isAsTechConfigured } from "./astech.config";
import { createRuntimeClient } from "./astech.runtime";

const log = createLogger("astech.refresh");

const TTL_MS = Math.max(15, Number(process.env.ASTECH_CATALOGUE_TTL_MINUTES) || 360) * 60_000;
const FAILURE_BACKOFF_MS = 5 * 60_000;

/**
 * Called from the user-facing catalogue route. Never blocks the response and
 * never calls the provider on every render: at most one background sync per
 * TTL, with a 5-minute cool-down after a failed attempt. Concurrent callers
 * are collapsed by syncCatalogue's single-flight guard.
 */
export function refreshCatalogueIfStale(): void {
  if (!isAsTechConfigured()) return;
  const last = getSyncState(db);
  const age = last ? Date.now() - new Date(last.at).getTime() : Infinity;
  const due = last?.ok ? age > TTL_MS : age > FAILURE_BACKOFF_MS;
  if (!due) return;
  syncCatalogue(db, createRuntimeClient()).catch((e) => log.warn("background_sync_failed", { message: e instanceof Error ? e.message : "unknown" }));
}
