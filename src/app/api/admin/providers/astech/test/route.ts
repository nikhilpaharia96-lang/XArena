import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { isAsTechConfigured } from "@/server/providers/astech/astech.config";
import { createRuntimeClient } from "@/server/providers/astech/astech.runtime";
import { testConnection } from "@/server/providers/astech/astech.service";

export const dynamic = "force-dynamic";

/** Safe health check: one read-only POST /currencies with a signed `{}`. */
export async function POST() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`astech-test:${admin.id}`, 6, 60_000).allowed) throw new ApiError(429, "Slow down.", "RATE_LIMITED");
    if (!isAsTechConfigured()) throw new ApiError(400, "Set ASTECH_API_KEY and ASTECH_SECRET_KEY first.", "NOT_CONFIGURED");

    const result = await testConnection(createRuntimeClient());
    writeAuditLog({ actorId: admin.id, action: "ASTECH_TEST_CONNECTION", targetType: "Provider", targetId: "astech", metadata: { ok: result.ok, errorKind: result.errorKind ?? null, requestId: result.requestId } });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
