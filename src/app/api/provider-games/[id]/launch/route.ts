import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { createRuntimeClient } from "@/server/providers/astech/astech.runtime";
import { getPublicAppUrl, isAsTechConfigured } from "@/server/providers/astech/astech.config";
import { launchGame } from "@/server/providers/astech/astech.service";
import { isBetnexConfigured } from "@/server/providers/betnex/betnex.config";
import { createRuntimeClient as createBetnexClient } from "@/server/providers/betnex/betnex.runtime";
import { launchBetnexGame } from "@/server/providers/betnex/betnex.service";
import { providerWallet } from "@/server/providers/wallet.instance";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ language: z.string().max(8).optional() }).strict();

/**
 * Frontend -> XArena backend -> AS Tech /session/open.
 * The browser never talks to AS Tech. The launch URL is single-use, so this
 * route is POST-only, never cached, and the URL is not stored.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(); // user can only launch for THEMSELVES — identity comes from the session cookie
    const { allowed } = checkRateLimit(`launch:${getClientKey(req)}:${user.id}`, 10, 60_000);
    if (!allowed) throw new ApiError(429, "Too many requests. Please slow down.", "RATE_LIMITED");

    const { id } = await context.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    // The game row decides which provider launches it; the client never names a provider.
    const game = db.prepare("SELECT provider FROM ProviderGame WHERE id = ?").get(id) as { provider: string } | undefined;
    if (!game) throw new ApiError(404, "This game is not available.", "GAME_NOT_FOUND");

    let result: { gameUrl: string; embeddable: boolean; singleUse: boolean; expiresIn: number | null; mode: string | null; category: string | null };

    if (game.provider === "betnex") {
      if (!isBetnexConfigured()) throw new ApiError(503, "Games are not available yet.", "PROVIDER_NOT_CONFIGURED");
      const ua = req.headers.get("user-agent") ?? "";
      result = await launchBetnexGame({
        db,
        client: createBetnexClient(),
        wallet: providerWallet,
        user: { id: user.id },
        gameId: id,
        language: body.language,
        platform: /Mobi|Android|iPhone|iPad/i.test(ua) ? 2 : 1,
        appUrl: getPublicAppUrl(),
      });
    } else {
      if (!isAsTechConfigured()) throw new ApiError(503, "Games are not available yet.", "PROVIDER_NOT_CONFIGURED");
      const row = db.prepare("SELECT uid FROM User WHERE id = ?").get(user.id) as { uid: string } | undefined;
      if (!row) throw new ApiError(401, "Account not found.", "UNAUTHENTICATED");
      result = await launchGame({
        db,
        client: createRuntimeClient(),
        user: { id: user.id, uid: row.uid },
        gameId: id,
        language: body.language,
        appUrl: getPublicAppUrl(),
      });
    }

    const res = ok({
      gameUrl: result.gameUrl,
      embeddable: result.embeddable,
      singleUse: result.singleUse,
      expiresIn: result.expiresIn,
      mode: result.mode,
      category: result.category,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
