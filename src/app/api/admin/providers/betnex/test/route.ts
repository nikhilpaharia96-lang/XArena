import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { BetnexError } from "@/server/providers/betnex/betnex.client";
import { isBetnexConfigured } from "@/server/providers/betnex/betnex.config";
import { createRuntimeClient } from "@/server/providers/betnex/betnex.runtime";

export const dynamic = "force-dynamic";

/** Read-only health check: GET /getallproviders with the configured key. */
export async function POST() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`betnex-test:${admin.id}`, 6, 60_000).allowed) throw new ApiError(429, "Slow down.", "RATE_LIMITED");
    if (!isBetnexConfigured()) throw new ApiError(400, "Finish the BETNEX setup first (see the notes on this page).", "NOT_CONFIGURED");

    const started = Date.now();
    try {
      const res = (await createRuntimeClient().get("/getallproviders")) as { success?: boolean; games?: unknown };
      const count = Array.isArray(res?.games) ? res.games.length : 0;
      return ok({ ok: res?.success === true, durationMs: Date.now() - started, providerCount: count });
    } catch (e) {
      if (e instanceof BetnexError) return ok({ ok: false, durationMs: Date.now() - started, providerCount: 0, error: e.message, errorKind: e.kind });
      throw e;
    }
  } catch (error) {
    return fail(error);
  }
}
