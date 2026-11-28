import type Database from "better-sqlite3";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createId } from "@/server/lib/ids";
import { createLogger } from "../logger";
import { WalletError, type ProviderWallet } from "../provider-wallet";
import { PROVIDER_ID, WALLET_CURRENCY, type BetnexConfig } from "./betnex.config";
import { decryptPayload } from "./betnex.crypto";
import { findUserByLogin } from "./betnex.players";

/**
 * BETNEX real-time bet/win callback (doc section 7).
 *
 *  - Authenticate, in order: source IP is a BETNEX server → decrypt (production) → `api_key` matches.
 *    Any failure → HTTP 400, no balance change.
 *  - Identity: `member_account` (our 2–3 char code + id). Round: `game_uid` + `game_round`.
 *    Idempotency: `serial_number` is unique only WITHIN a round, so the transaction id is
 *    `login|game_uid|game_round|serial_number`.
 *  - Balance: new = balance - bet_amount + win_amount. Negative amounts are refunds/corrections and use the
 *    same formula. The wallet engine applies it per round, so deposit money stays play-only (see applyRoundEvent).
 *  - Reply with ONLY 200 / 400 / 500 and { success, msg, handle, money }.
 *      200  processed, or a duplicate/retry (balance unchanged);
 *      400  the callback is not acceptable (bad IP / undecryptable / wrong api_key / bad fields / unknown player);
 *      500  failure on our side.
 *  - Duplicates NEVER get an error status.
 */

const log = createLogger("betnex.callback");
const MAX_BODY_BYTES = 64 * 1024;

export interface CallbackReply {
  status: 200 | 400 | 500;
  body: { success: boolean; msg: string; handle: boolean; money?: number };
}

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const money = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .refine((n) => Number.isFinite(n), "must be a number");

const callbackSchema = z.object({
  api_key: z.string().min(1),
  member_account: text.refine((s) => s.length > 0 && s.length <= 64),
  game_uid: text.refine((s) => s.length > 0 && s.length <= 128),
  game_round: text.refine((s) => s.length > 0 && s.length <= 128),
  serial_number: text.refine((s) => s.length > 0 && s.length <= 128),
  // Optional: the wallet is INR-only, so an absent currency means INR. A present, non-INR one is refused below.
  currency_code: z.string().trim().min(1).max(10).optional(),
  bet_amount: money,
  win_amount: money,
});

const reject = (msg: string): CallbackReply => ({ status: 400, body: { success: false, msg, handle: false } });
const failure = (msg: string): CallbackReply => ({ status: 500, body: { success: false, msg, handle: false } });

export const rupeesToPaise = (n: number) => Math.round(n * 100);

/** "::ffff:1.2.3.4" → "1.2.3.4"; lowercases IPv6. */
export function normalizeIp(ip: string): string {
  const v = ip.trim().toLowerCase();
  return v.startsWith("::ffff:") && v.includes(".") ? v.slice(7) : v;
}

function keysEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface CallbackDeps {
  db: Database.Database;
  wallet: ProviderWallet;
  config: BetnexConfig;
}

interface LogFields {
  txId?: string | null;
  outcome: string;
  error?: string | null;
  httpStatus: number;
}

/** The api_key never reaches the log. */
function excerpt(rawBody: string): string {
  return rawBody.replace(/("api_key"\s*:\s*")[^"]*(")/g, "$1[redacted]$2").slice(0, 2000);
}

function writeLog(db: Database.Database, rawBody: string, f: LogFields) {
  try {
    db.prepare(
      `INSERT INTO ProviderCallbackLog (id, provider, method, providerTransactionId, signatureValid, httpStatus, outcome, error, bodyExcerpt, createdAt)
       VALUES (?, ?, 'callback', ?, ?, ?, ?, ?, ?, ?)`
    ).run(createId("pcb"), PROVIDER_ID, f.txId ?? null, f.outcome === "APPLIED" || f.outcome === "DUPLICATE" ? 1 : 0, f.httpStatus, f.outcome, f.error ?? null, excerpt(rawBody), new Date().toISOString());
  } catch (e) {
    log.error("callback_log_write_failed", { message: e instanceof Error ? e.message : "unknown" });
  }
}

export function handleBetnexCallback(rawBody: string, clientIp: string | null, deps: CallbackDeps): CallbackReply {
  const { db, wallet, config } = deps;
  const done = (reply: CallbackReply, f: Omit<LogFields, "httpStatus">): CallbackReply => {
    writeLog(db, rawBody, { ...f, httpStatus: reply.status });
    return reply;
  };

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return done(reject("Payload too large"), { outcome: "PAYLOAD_TOO_LARGE" });

  // 1) Source IP — before anything else is read.
  if (!config.testMode) {
    if (config.callbackIps.length === 0) {
      log.error("callback_ip_allowlist_empty");
      return done(reject("Invalid callback"), { outcome: "IP_ALLOWLIST_EMPTY", error: clientIp });
    }
    const allowed = new Set(config.callbackIps.map(normalizeIp));
    if (!clientIp || !allowed.has(normalizeIp(clientIp))) {
      log.warn("callback_ip_rejected", { ip: clientIp });
      return done(reject("Invalid callback"), { outcome: "IP_NOT_ALLOWED", error: clientIp });
    }
  }

  // 2) Parse + decrypt.
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return done(reject("Invalid callback"), { outcome: "BAD_JSON" });
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return done(reject("Invalid callback"), { outcome: "BAD_JSON" });

  let data: unknown = json;
  const wrapped = (json as { payload?: unknown }).payload;
  if (typeof wrapped === "string") {
    if (!config.encryptionKey) return done(reject("Invalid callback"), { outcome: "DECRYPT_NOT_CONFIGURED" });
    data = decryptPayload(wrapped, config.encryptionKey);
    if (data === null) {
      log.warn("callback_decrypt_failed");
      return done(reject("Invalid callback"), { outcome: "DECRYPT_FAILED" });
    }
  } else if (!config.testMode) {
    // Production accepts encrypted callbacks only.
    return done(reject("Invalid callback"), { outcome: "ENCRYPTION_REQUIRED" });
  }

  // 3) Validate fields + authenticate with the echoed api_key.
  const parsed = callbackSchema.safeParse(data);
  if (!parsed.success) {
    return done(reject("Invalid callback"), { outcome: "BAD_PAYLOAD", error: parsed.error.issues[0]?.path.join(".") ?? "invalid" });
  }
  const p = parsed.data;
  if (!keysEqual(p.api_key, config.apiKey)) {
    log.warn("callback_api_key_mismatch");
    return done(reject("Invalid callback"), { outcome: "API_KEY_MISMATCH" });
  }
  if (p.currency_code !== undefined && p.currency_code.toUpperCase() !== WALLET_CURRENCY) {
    return done(reject("Unsupported currency"), { outcome: "UNSUPPORTED_CURRENCY", error: p.currency_code });
  }

  const login = p.member_account.toLowerCase();
  const txId = `${login}|${p.game_uid}|${p.game_round}|${p.serial_number}`;

  // 4) Identify the player.
  const user = findUserByLogin(db, login);
  if (!user) return done(reject("Player not found"), { txId, outcome: "PLAYER_NOT_FOUND" });

  // 5) Amounts → integer paise. Negative = refund/correction.
  const bet = rupeesToPaise(p.bet_amount);
  const win = rupeesToPaise(p.win_amount);
  if (Math.abs(bet) > 1e11 || Math.abs(win) > 1e11) return done(reject("Invalid callback"), { txId, outcome: "BAD_PAYLOAD", error: "amount out of range" });

  const blocked = user.status === "BANNED" || user.status === "SUSPENDED";
  if (blocked && bet > 0) return done(reject("Player blocked"), { txId, outcome: "PLAYER_BLOCKED" });

  // 6) Apply — wallet + ProviderTransaction + callback log commit or roll back together.
  try {
    const run = db.transaction(() => {
      const result = wallet.applyRoundEvent({
        provider: PROVIDER_ID,
        providerTransactionId: txId,
        userId: user.id,
        roundKey: `${p.game_uid}:${p.game_round}`,
        providerGameId: p.game_uid,
        currency: WALLET_CURRENCY,
        stakePaise: Math.max(bet, 0),
        stakeRefundPaise: Math.max(-bet, 0),
        winPaise: Math.max(win, 0),
        winReversalPaise: Math.max(-win, 0),
        metadata: { serial: p.serial_number },
      });
      writeLog(db, rawBody, { txId, outcome: result.outcome, httpStatus: 200 });
      return result;
    });
    const result = run.immediate();
    log.info("callback_applied", { outcome: result.outcome, game: p.game_uid, round: p.game_round, bet, win });
    return {
      status: 200,
      body: {
        success: true,
        msg: result.outcome === "APPLIED" ? "Callback processed successfully" : "Duplicate callback ignored",
        handle: true,
        money: result.balancePaise / 100,
      },
    };
  } catch (e) {
    if (e instanceof WalletError) {
      // The failed wallet transaction was rolled back in full; record why (outside it).
      const bad = e.code === "INVALID_AMOUNT" || e.code === "TRANSACTION_CONFLICT";
      writeLog(db, rawBody, { txId, outcome: e.code, error: e.message, httpStatus: bad ? 400 : 500 });
      log.warn("callback_rejected", { code: e.code, game: p.game_uid, round: p.game_round });
      return bad ? reject(e.code) : failure(e.code);
    }
    log.error("callback_error", { message: e instanceof Error ? e.message : "unknown" });
    writeLog(db, rawBody, { txId, outcome: "INTERNAL_ERROR", httpStatus: 500 });
    return failure("Callback failed");
  }
}
