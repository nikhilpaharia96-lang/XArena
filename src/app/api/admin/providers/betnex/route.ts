import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getSyncState } from "@/server/providers/betnex/betnex.catalogue";
import { CALLBACK_PATH, DEFAULT_BASE_URL, PROVIDER_ID, isBetnexConfigured, normalizeCode } from "@/server/providers/betnex/betnex.config";

export const dynamic = "force-dynamic";

const appUrl = () => process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, "") || null;

/** Admin overview of the BETNEX integration. Never returns a secret — only whether it is set. */
export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const env = process.env;
    const testMode = env.BETNEX_TEST_MODE === "true";
    const ips = (env.BETNEX_CALLBACK_IPS ?? "").split(",").filter((s) => s.trim()).length;
    const encryption = Boolean(env.BETNEX_ENCRYPTION_KEY?.trim());
    const url = appUrl();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

    const counts = db
      .prepare("SELECT COUNT(*) total, COALESCE(SUM(isEnabled),0) enabled, COALESCE(SUM(isAvailable),0) available FROM ProviderGame WHERE provider = ?")
      .get(PROVIDER_ID) as { total: number; enabled: number; available: number };
    const providers = db
      .prepare(
        `SELECT providerName, COUNT(*) total, COALESCE(SUM(isEnabled),0) enabled FROM ProviderGame
         WHERE provider = ? AND isAvailable = 1 GROUP BY providerName ORDER BY providerName`
      )
      .all(PROVIDER_ID) as { providerName: string; total: number; enabled: number }[];
    const categories = db
      .prepare("SELECT DISTINCT category FROM ProviderGame WHERE provider = ? AND isAvailable = 1 ORDER BY category")
      .all(PROVIDER_ID) as { category: string }[];
    const lastReq = db
      .prepare("SELECT ok, httpStatus, errorKind, createdAt FROM ProviderRequestLog WHERE provider = ? ORDER BY createdAt DESC LIMIT 1")
      .get(PROVIDER_ID) as { ok: number; httpStatus: number | null; errorKind: string | null; createdAt: string } | undefined;
    const recentCallbacks = db
      .prepare("SELECT outcome, httpStatus, error, createdAt FROM ProviderCallbackLog WHERE provider = ? ORDER BY createdAt DESC LIMIT 20")
      .all(PROVIDER_ID) as { outcome: string; httpStatus: number; error: string | null; createdAt: string }[];
    const problems = db
      .prepare("SELECT COUNT(*) c FROM ProviderCallbackLog WHERE provider = ? AND httpStatus != 200 AND createdAt > ?")
      .get(PROVIDER_ID, dayAgo) as { c: number };
    const failedRequests = db
      .prepare("SELECT COUNT(*) c FROM ProviderRequestLog WHERE provider = ? AND ok = 0 AND createdAt > ?")
      .get(PROVIDER_ID, dayAgo) as { c: number };

    const configured = isBetnexConfigured();
    const notes: string[] = [];
    if (!env.BETNEX_API_KEY?.trim()) notes.push("BETNEX_API_KEY is not set.");
    if (!normalizeCode(env.BETNEX_USERNAME_CODE)) notes.push("BETNEX_USERNAME_CODE must be 2–3 letters/digits (e.g. k7x). Choose it once and never change it.");
    if (!testMode && !encryption) notes.push("BETNEX_ENCRYPTION_KEY is not set — BETNEX requires encrypted requests and callbacks in production.");
    if (!testMode && ips === 0) notes.push("BETNEX_CALLBACK_IPS is empty — every callback will be rejected until you add BETNEX's server IPs.");
    if (testMode) notes.push("TEST MODE is ON: plain-JSON callbacks are accepted and the IP allowlist is skipped. Turn BETNEX_TEST_MODE off before going live.");
    if (!url?.startsWith("https://")) notes.push("APP_PUBLIC_URL must be your public HTTPS address — BETNEX only registers HTTPS callback URLs.");
    notes.push("Before going live, run every case in the BETNEX Callback Tester (https://casinoapi.betnex.co/callback-tester) against the callback URL above, and re-run it after any change.");
    notes.push("BETNEX callbacks reach this app through your reverse proxy: set BETNEX_TRUSTED_PROXY_HOPS to the number of proxies in front of it (default 1) so the real source IP can be checked.");

    return ok({
      provider: "BETNEX",
      configured,
      testMode,
      config: {
        apiBaseUrl: env.BETNEX_API_BASE_URL || DEFAULT_BASE_URL,
        apiKeyConfigured: Boolean(env.BETNEX_API_KEY?.trim()),
        usernameCode: normalizeCode(env.BETNEX_USERNAME_CODE),
        usernamePosition: env.BETNEX_USERNAME_POSITION === "suffix" ? "suffix" : "prefix",
        encryptionConfigured: encryption,
        callbackIpCount: ips,
        publicAppUrl: url,
        callbackUrl: url ? `${url}${CALLBACK_PATH}` : null,
        publicUrlIsHttps: Boolean(url?.startsWith("https://")),
      },
      catalogue: { ...counts, lastSync: getSyncState(db) },
      providers,
      categories: categories.map((c) => c.category),
      lastRequest: lastReq ?? null,
      recentCallbacks,
      problemCallbacks24h: problems.c,
      failedRequests24h: failedRequests.c,
      notes,
    });
  } catch (error) {
    return fail(error);
  }
}
