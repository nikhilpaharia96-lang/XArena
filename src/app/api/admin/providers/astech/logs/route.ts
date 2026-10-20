import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { PROVIDER_ID } from "@/server/providers/astech/astech.config";

export const dynamic = "force-dynamic";

/** type=callbacks (default) | requests. Optional failedOnly=1. */
export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const u = new URL(req.url);
    const type = u.searchParams.get("type") === "requests" ? "requests" : "callbacks";
    const failedOnly = u.searchParams.get("failedOnly") === "1";
    const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
    const limit = 50;

    if (type === "requests") {
      const where = failedOnly ? "AND ok = 0" : "";
      const total = (db.prepare(`SELECT COUNT(*) c FROM ProviderRequestLog WHERE provider = ? ${where}`).get(PROVIDER_ID) as { c: number }).c;
      const logs = db
        .prepare(`SELECT id, endpoint, ok, httpStatus, attempts, durationMs, providerRequestId, errorKind, createdAt FROM ProviderRequestLog WHERE provider = ? ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
        .all(PROVIDER_ID, limit, (page - 1) * limit);
      return ok({ type, logs, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
    }

    const where = failedOnly ? "AND outcome NOT IN ('BALANCE_OK','APPLIED','DUPLICATE','ROLLBACK_ROLLED_BACK','ROLLBACK_DUPLICATE','ROLLBACK_TOMBSTONED','IGNORED_ROLLED_BACK')" : "";
    const total = (db.prepare(`SELECT COUNT(*) c FROM ProviderCallbackLog WHERE provider = ? ${where}`).get(PROVIDER_ID) as { c: number }).c;
    const logs = db
      .prepare(`SELECT id, method, providerTransactionId, signatureValid, httpStatus, outcome, error, createdAt FROM ProviderCallbackLog WHERE provider = ? ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
      .all(PROVIDER_ID, limit, (page - 1) * limit);
    return ok({ type, logs, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return fail(error);
  }
}
