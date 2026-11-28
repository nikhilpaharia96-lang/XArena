import type Database from "better-sqlite3";
import { ApiError } from "@/server/lib/api-response";
import { createId } from "@/server/lib/ids";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { createLogger } from "../logger";
import type { ProviderWallet } from "../provider-wallet";
import { BetnexClient, BetnexError } from "./betnex.client";
import { PROVIDER_ID, WALLET_CURRENCY } from "./betnex.config";
import { encryptPayload } from "./betnex.crypto";
import { getOrCreateLogin } from "./betnex.players";

const log = createLogger("betnex.service");

export interface BetnexLaunchInput {
  db: Database.Database;
  client: BetnexClient;
  wallet: ProviderWallet;
  user: { id: string };
  /** ProviderGame.id (XArena's own id — the client never supplies a provider game id). */
  gameId: string;
  language?: string;
  /** 1 = desktop, 2 = mobile (BETNEX `platform`). */
  platform: 1 | 2;
  /** XArena public https origin, e.g. https://xarena.in */
  appUrl: string | null;
}

export interface BetnexLaunchResult {
  gameUrl: string;
  embeddable: boolean;
  singleUse: boolean;
  expiresIn: number | null;
  mode: string | null;
  category: string | null;
}

interface GameRow {
  id: string;
  providerGameId: string;
  category: string;
  isEnabled: number;
  isAvailable: number;
  currencies: string;
}

const LANG = /^[a-z]{2}(-[A-Za-z]{2})?$/;

// Collapses a double-click into one provider call; never shared across users/games, never outlives the request.
const inFlight = new Map<string, Promise<BetnexLaunchResult>>();

export function launchBetnexGame(input: BetnexLaunchInput): Promise<BetnexLaunchResult> {
  const key = `${input.user.id}:${input.gameId}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = doLaunch(input).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function doLaunch({ db, client, wallet, user, gameId, language, platform, appUrl }: BetnexLaunchInput): Promise<BetnexLaunchResult> {
  if (!appUrl || !appUrl.startsWith("https://")) {
    throw new ApiError(503, "Games are not available yet.", "PROVIDER_NOT_CONFIGURED");
  }

  const game = db
    .prepare("SELECT id, providerGameId, category, isEnabled, isAvailable, currencies FROM ProviderGame WHERE id = ? AND provider = ?")
    .get(gameId, PROVIDER_ID) as GameRow | undefined;
  if (!game || !game.isEnabled || !game.isAvailable) throw new ApiError(404, "This game is not available.", "GAME_NOT_FOUND");
  try {
    if (!(JSON.parse(game.currencies) as string[]).includes(WALLET_CURRENCY)) throw new Error();
  } catch {
    throw new ApiError(400, "This game isn't available in INR.", "CURRENCY_NOT_SUPPORTED");
  }

  let balancePaise: number;
  try {
    balancePaise = wallet.getBalance(user.id);
  } catch {
    throw new ApiError(400, "Wallet not found.", "WALLET_NOT_FOUND");
  }

  if (!checkRateLimit("betnex:global", 100, 60_000).allowed) {
    throw new ApiError(429, "Too many requests. Please try again in a moment.", "PROVIDER_BUSY");
  }

  const cfg = client.config;
  const body = {
    username: getOrCreateLogin(db, user.id, cfg),
    gameId: game.providerGameId,
    // The session's starting balance. Callbacks then keep it in sync with XArena's wallet.
    money: balancePaise / 100,
    platform,
    currency: WALLET_CURRENCY,
    home_url: `${appUrl}/games`,
    lang: language && LANG.test(language) ? language : "en",
  };

  // Production: the request body must be encrypted and sent as { payload }. Plain JSON is for the test environment only.
  const requestBody = cfg.encryptionKey ? { payload: encryptPayload(body, cfg.encryptionKey) } : body;

  let res: { code?: number; msg?: string; payload?: { game_launch_url?: string; expires_in?: number } };
  try {
    res = await client.post("/getgameurl", requestBody);
  } catch (e) {
    if (e instanceof BetnexError) {
      log.error("launch_failed", { kind: e.kind, status: e.status, userId: user.id });
      if (e.kind === "AUTH") throw new ApiError(503, "Games are not available right now.", "PROVIDER_ERROR");
      throw new ApiError(502, "We couldn't start this game. Please try again.", "PROVIDER_ERROR");
    }
    throw e;
  }

  const url = res?.payload?.game_launch_url;
  if (res?.code !== 0 || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    log.error("launch_rejected", { code: res?.code ?? null, msg: res?.msg ?? null, userId: user.id });
    throw new ApiError(502, "We couldn't start this game. Please try again later.", "PROVIDER_ERROR");
  }
  const expiresIn = typeof res.payload?.expires_in === "number" ? res.payload.expires_in : 60;

  // The launch URL expires in 60 s and must never be cached or stored — it only goes back to the caller.
  db.prepare(
    `INSERT INTO ProviderGameSession
       (id, provider, userId, providerGameId, providerSessionId, currency, mode, demo, embeddable, singleUse, expiresIn, providerRequestId, createdAt)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, 0, 0, 1, ?, NULL, ?)`
  ).run(createId("pgs"), PROVIDER_ID, user.id, game.providerGameId, WALLET_CURRENCY, expiresIn, new Date().toISOString());
  log.info("launch_ok", { userId: user.id, gameId: game.id });

  return { gameUrl: url, embeddable: false, singleUse: true, expiresIn, mode: null, category: game.category };
}
