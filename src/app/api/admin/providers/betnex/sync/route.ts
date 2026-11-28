import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { syncCatalogue } from "@/server/providers/betnex/betnex.catalogue";
import { BetnexError } from "@/server/providers/betnex/betnex.client";
import { isBetnexConfigured } from "@/server/providers/betnex/betnex.config";
import { createRuntimeClient } from "@/server/providers/betnex/betnex.runtime";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`betnex-sync:${admin.id}`, 3, 60_000).allowed) throw new ApiError(429, "Slow down.", "RATE_LIMITED");
    if (!isBetnexConfigured()) throw new ApiError(400, "Finish the BETNEX setup first (see the notes on this page).", "NOT_CONFIGURED");

    try {
      const state = await syncCatalogue(db, createRuntimeClient());
      writeAuditLog({ actorId: admin.id, action: "BETNEX_SYNC_GAMES", targetType: "Provider", targetId: "betnex", metadata: { ...state } });
      return ok(state);
    } catch (e) {
      if (e instanceof BetnexError) throw new ApiError(502, `Sync failed (${e.kind}): ${e.message}`, "SYNC_FAILED");
      throw e;
    }
  } catch (error) {
    return fail(error);
  }
}
