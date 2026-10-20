import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getStoredCurrencies, getSyncState } from "@/server/providers/astech/astech.catalogue";
import {
  CALLBACK_PATH,
  DEFAULT_ASTECH_BASE_URL,
  PROVIDER_ID,
  getPublicAppUrl,
  isAsTechConfigured,
} from "@/server/providers/astech/astech.config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const one = <T,>(sql: string, ...args: unknown[]) => db.prepare(sql).get(PROVIDER_ID, ...args) as T;
    const counts = one<{ total: number; enabled: number; available: number }>(
      `SELECT COUNT(*) total, COALESCE(SUM(isEnabled),0) enabled, COALESCE(SUM(isAvailable),0) available FROM ProviderGame WHERE provider = ?`
    );
    const lastReq = db
      .prepare("SELECT ok, httpStatus, errorKind, providerRequestId, createdAt FROM ProviderRequestLog WHERE provider = ? ORDER BY createdAt DESC LIMIT 1")
      .get(PROVIDER_ID) as { ok: number; httpStatus: number | null; errorKind: string | null; providerRequestId: string | null; createdAt: string } | undefined;
    const lastCb = db
      .prepare("SELECT outcome, createdAt FROM ProviderCallbackLog WHERE provider = ? ORDER BY createdAt DESC LIMIT 1")
      .get(PROVIDER_ID) as { outcome: string; createdAt: string } | undefined;
    const failures24h = one<{ c: number }>(
      "SELECT COUNT(*) c FROM ProviderRequestLog WHERE provider = ? AND ok = 0 AND createdAt > ?",
      new Date(Date.now() - 86_400_000).toISOString()
    ).c;
    const badCallbacks24h = one<{ c: number }>(
      "SELECT COUNT(*) c FROM ProviderCallbackLog WHERE provider = ? AND outcome IN ('SIGNATURE_INVALID','INTERNAL_ERROR','BAD_PAYLOAD','PLAYER_NOT_FOUND') AND createdAt > ?",
      new Date(Date.now() - 86_400_000).toISOString()
    ).c;

    const configured = isAsTechConfigured();
    const appUrl = getPublicAppUrl();
    const status = !configured ? "DISCONNECTED" : !lastReq ? "NOT_TESTED" : lastReq.ok ? "CONNECTED" : "ERROR";

    return ok({
      provider: "AS Tech",
      status,
      config: {
        apiBaseUrl: process.env.ASTECH_API_BASE_URL || DEFAULT_ASTECH_BASE_URL,
        apiKeyConfigured: Boolean(process.env.ASTECH_API_KEY), // never the value
        secretConfigured: Boolean(process.env.ASTECH_SECRET_KEY), // never the value
        publicAppUrl: appUrl,
        callbackUrl: appUrl ? `${appUrl}${CALLBACK_PATH}` : null,
        publicUrlIsHttps: Boolean(appUrl?.startsWith("https://")),
      },
      catalogue: { ...counts, lastSync: getSyncState(db), inrAvailable: getStoredCurrencies(db).some((c) => c.code === "INR") },
      lastRequest: lastReq ?? null,
      lastCallback: lastCb ?? null,
      failedRequests24h: failures24h,
      problemCallbacks24h: badCallbacks24h,
      notes: [
        "Server IP, domain and callback URL are whitelisted in the AS Tech panel (API Details). They cannot be verified from here; a 403 on Test Connection usually means one of them is missing.",
      ],
    });
  } catch (error) {
    return fail(error);
  }
}
