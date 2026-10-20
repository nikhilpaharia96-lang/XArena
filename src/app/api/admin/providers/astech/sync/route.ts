import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { syncCatalogue } from "@/server/providers/astech/astech.catalogue";
import { isAsTechConfigured } from "@/server/providers/astech/astech.config";
import { AsTechError } from "@/server/providers/astech/astech.errors";
import { createRuntimeClient } from "@/server/providers/astech/astech.runtime";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`astech-sync:${admin.id}`, 3, 60_000).allowed) throw new ApiError(429, "Slow down.", "RATE_LIMITED");
    if (!isAsTechConfigured()) throw new ApiError(400, "Set ASTECH_API_KEY and ASTECH_SECRET_KEY first.", "NOT_CONFIGURED");

    try {
      const state = await syncCatalogue(db, createRuntimeClient());
      writeAuditLog({ actorId: admin.id, action: "ASTECH_SYNC_GAMES", targetType: "Provider", targetId: "astech", metadata: { ...state } });
      return ok(state);
    } catch (e) {
      if (e instanceof AsTechError) {
        // Admins get the real reason; it still contains no credentials.
        throw new ApiError(502, `Sync failed (${e.kind}${e.requestId ? `, request ${e.requestId}` : ""}): ${e.message}`, "SYNC_FAILED");
      }
      throw e;
    }
  } catch (error) {
    return fail(error);
  }
}
