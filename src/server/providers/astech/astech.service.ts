import type Database from "better-sqlite3";
import { ApiError } from "@/server/lib/api-response";
import { createId } from "@/server/lib/ids";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { createLogger } from "../logger";
import { toPlayerLogin } from "../player-identity";
import type { AsTechClient } from "./astech.client";
import { fetchCurrencies, supportsCurrency } from "./astech.catalogue";
import { PROVIDER_ID, WALLET_CURRENCY } from "./astech.config";
import { AsTechError, publicMessageFor } from "./astech.errors";
import type { AsTechSession, AsTechSessionOpenRequest } from "./astech.types";

const log = createLogger("astech.service");

export interface LaunchInput {
  db: Database.Database;
  client: AsTechClient;
  user: { id: string; uid: string };
  /** ProviderGame.id (XArena's own id — the client never supplies a provider game id). */
  gameId: string;
  language?: string;
  /** XArena public https origin, e.g. https://xarena.in */
  appUrl: string | null;
}

export interface LaunchResult {
  sessionId: string;
  gameUrl: string;
  embeddable: boolean;
  singleUse: boolean;
  expiresIn: number | null;
  mode: string | null;
  demo: boolean;
  category: string | null;
}

interface GameRow {
  id: string;
  providerGameId: string;
  isEnabled: number;
  isAvailable: number;
  currencies: string;
}

const LANG = /^[a-z]{2}(-[A-Za-z]{2})?$/;

// Collapses a double-click / double-submit into one provider call. Never shared
// across users or games, and never outlives the request (single-use URLs are not cached).
const inFlight = new Map<string, Promise<LaunchResult>>();

export function launchGame(input: LaunchInput): Promise<LaunchResult> {
  const key = `${input.user.id}:${input.gameId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = doLaunch(input).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function doLaunch({ db, client, user, gameId, language, appUrl }: LaunchInput): Promise<LaunchResult> {
  if (!appUrl || !appUrl.startsWith("https://")) {
    // AS Tech requires exit_url to be HTTPS on the whitelisted domain.
    throw new ApiError(503, "Games are not available yet.", "PROVIDER_NOT_CONFIGURED");
  }

  const game = db
    .prepare("SELECT id, providerGameId, isEnabled, isAvailable, currencies FROM ProviderGame WHERE id = ? AND provider = ?")
    .get(gameId, PROVIDER_ID) as GameRow | undefined;
  if (!game || !game.isEnabled || !game.isAvailable) {
    throw new ApiError(404, "This game is not available.", "GAME_NOT_FOUND");
  }
  // Currency availability comes from the catalogue, never assumed.
  if (!supportsCurrency(game, WALLET_CURRENCY)) {
    throw new ApiError(400, "This game isn't available in INR.", "CURRENCY_NOT_SUPPORTED");
  }

  const wallet = db.prepare("SELECT id FROM Wallet WHERE userId = ?").get(user.id);
  if (!wallet) throw new ApiError(400, "Wallet not found.", "WALLET_NOT_FOUND");

  // Stay under AS Tech's 120 req/min/key limit with headroom.
  if (!checkRateLimit("astech:global", 110, 60_000).allowed) {
    throw new ApiError(429, "Too many requests. Please try again in a moment.", "PROVIDER_BUSY");
  }

  const request: AsTechSessionOpenRequest = {
    player_login: toPlayerLogin(user.uid),
    game_id: game.providerGameId,
    currency: WALLET_CURRENCY,
    language: language && LANG.test(language) ? language : "en",
    exit_url: `${appUrl}/games`,
  };

  let session: AsTechSession;
  let requestId: string | null = null;
  try {
    const res = await client.post<AsTechSession>("/api/public/v1/session/open", request);
    session = res.data;
    requestId = res.meta.requestId;
  } catch (e) {
    if (e instanceof AsTechError) {
      log.error("launch_failed", { kind: e.kind, status: e.status, requestId: e.requestId, userId: user.id });
      const pub = publicMessageFor(e);
      throw new ApiError(pub.status, pub.message, pub.code);
    }
    throw e;
  }

  if (!session || typeof session.gameUrl !== "string" || !/^https?:\/\//i.test(session.gameUrl) || typeof session.embeddable !== "boolean") {
    log.error("launch_invalid_response", { requestId });
    throw new ApiError(502, "We couldn't start this game. Please try again later.", "PROVIDER_ERROR");
  }

  // The launch URL is single-use and short-lived: it is returned to the caller
  // and deliberately NOT persisted anywhere.
  db.prepare(
    `INSERT INTO ProviderGameSession
       (id, provider, userId, providerGameId, providerSessionId, currency, mode, demo, embeddable, singleUse, expiresIn, providerRequestId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    createId("pgs"),
    PROVIDER_ID,
    user.id,
    game.providerGameId,
    session.sessionId ?? null,
    WALLET_CURRENCY,
    session.mode ?? null,
    session.demo ? 1 : 0,
    session.embeddable ? 1 : 0,
    session.singleUse ? 1 : 0,
    typeof session.expiresIn === "number" ? session.expiresIn : null,
    requestId,
    new Date().toISOString()
  );
  log.info("launch_ok", { userId: user.id, gameId: game.id, embeddable: session.embeddable, requestId });

  return {
    sessionId: session.sessionId,
    gameUrl: session.gameUrl,
    embeddable: session.embeddable,
    singleUse: session.singleUse ?? true,
    expiresIn: typeof session.expiresIn === "number" ? session.expiresIn : null,
    mode: session.mode ?? null,
    demo: Boolean(session.demo),
    category: session.category ?? null,
  };
}

export interface ConnectionTestResult {
  ok: boolean;
  durationMs: number;
  requestId: string | null;
  currencyCount: number;
  inrSupported: boolean;
  error?: string;
  errorKind?: string;
}

/** Safe, read-only health check: the documented /currencies endpoint, `{}` body. */
export async function testConnection(client: AsTechClient): Promise<ConnectionTestResult> {
  const started = Date.now();
  try {
    const res = await client.post("/api/public/v1/currencies", {});
    const currencies = await import("./astech.catalogue").then((m) => m.parseCurrencies(res.data));
    return {
      ok: true,
      durationMs: Date.now() - started,
      requestId: res.meta.requestId,
      currencyCount: currencies.length,
      inrSupported: currencies.some((c) => c.code === WALLET_CURRENCY),
    };
  } catch (e) {
    const err = e instanceof AsTechError ? e : null;
    return {
      ok: false,
      durationMs: Date.now() - started,
      requestId: err?.requestId ?? null,
      currencyCount: 0,
      inrSupported: false,
      error: err ? err.message : "Connection test failed",
      errorKind: err?.kind ?? "UNKNOWN",
    };
  }
}

export { fetchCurrencies };
