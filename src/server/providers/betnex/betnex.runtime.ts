import { db } from "@/server/db/client";
import { createId } from "@/server/lib/ids";
import { BetnexClient } from "./betnex.client";
import { PROVIDER_ID } from "./betnex.config";

/** Client bound to XArena's real DB: every BETNEX request is recorded in ProviderRequestLog (90-day retention is on you). */
export function createRuntimeClient(): BetnexClient {
  return new BetnexClient({
    onRequest: (r) => {
      try {
        db.prepare(
          `INSERT INTO ProviderRequestLog (id, provider, endpoint, ok, httpStatus, attempts, durationMs, providerRequestId, errorKind, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
        ).run(createId("preq"), PROVIDER_ID, r.endpoint, r.ok ? 1 : 0, r.status, r.attempts, r.durationMs, r.errorKind, new Date().toISOString());
      } catch {
        /* logging must never break a request */
      }
    },
  });
}
