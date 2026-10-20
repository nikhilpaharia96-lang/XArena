import { db } from "@/server/db/client";
import { createId } from "@/server/lib/ids";
import { AsTechClient } from "./astech.client";
import { PROVIDER_ID } from "./astech.config";

/** Client bound to XArena's real DB: every provider request is recorded in ProviderRequestLog. */
export function createRuntimeClient(): AsTechClient {
  return new AsTechClient({
    onRequest: (r) => {
      try {
        db.prepare(
          `INSERT INTO ProviderRequestLog (id, provider, endpoint, ok, httpStatus, attempts, durationMs, providerRequestId, errorKind, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(createId("preq"), PROVIDER_ID, r.endpoint, r.ok ? 1 : 0, r.status, r.attempts, r.durationMs, r.requestId, r.errorKind, new Date().toISOString());
      } catch {
        /* logging must never break a request */
      }
    },
  });
}
