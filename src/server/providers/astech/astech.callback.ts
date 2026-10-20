import type Database from "better-sqlite3";
import { z } from "zod";
import { createId } from "@/server/lib/ids";
import { createLogger } from "../logger";
import { findUserByPlayerLogin } from "../player-identity";
import { WalletError, type ProviderWallet } from "../provider-wallet";
import { PROVIDER_ID, WALLET_CURRENCY } from "./astech.config";
import { verifySignature } from "./astech.signature";

/**
 * AS Tech seamless-wallet callback (https://astechapi.cloud/docs#callbacks).
 *
 * Verified contract:
 *  - POST, JSON, `X-Signature` = hex HMAC-SHA256(secret, RAW body).
 *  - cmd: "getBalance" | "writeBet" | "rollback".
 *  - Every field arrives twice (snake_case + camelCase alias).
 *  - ONE writeBet per finished round: { bet, win, amount, transaction_id,
 *    round_id, game_id, session_id, round_finished }.
 *  - Reply: always HTTP 200 with
 *      { status:"success", error:"", content:{ cash:"99.00" } }
 *      { status:"fail",    error:"<CODE>", content:null }
 *  - Same transaction_id twice => return the stored balance, never re-apply.
 *  - rollback of an unknown transaction => success + current balance.
 *  - Must answer within 3 seconds (all work here is synchronous SQLite).
 */

const log = createLogger("astech.callback");

export type CallbackReply =
  | { status: "success"; error: ""; content: { cash: string } }
  | { status: "fail"; error: string; content: null };

const MAX_BODY_BYTES = 64 * 1024;

const amount = z.union([z.number(), z.string()]);
const str = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const payloadSchema = z
  .object({
    cmd: z.enum(["getBalance", "writeBet", "rollback"]),
    user_login: str.optional(),
    login: str.optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    bet: amount.optional(),
    win: amount.optional(),
    transaction_id: str.optional(),
    transactionId: str.optional(),
    round_id: str.optional(),
    roundId: str.optional(),
    game_id: str.optional(),
    gameId: str.optional(),
    session_id: str.optional(),
    round_finished: z.union([z.boolean(), z.string(), z.number()]).optional(),
  })
  .passthrough();

export function formatCash(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** Provider decimal (number|string, max 2 dp) -> integer paise. Throws on anything ambiguous. */
export function decimalToPaise(value: number | string | undefined, label: string): number {
  if (value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new WalletError("INVALID_AMOUNT", `${label} must be a non-negative number`);
  const paise = Math.round(n * 100);
  if (Math.abs(n * 100 - paise) > 1e-6) throw new WalletError("INVALID_AMOUNT", `${label} has more than 2 decimals`);
  return paise;
}

const ok = (paise: number): CallbackReply => ({ status: "success", error: "", content: { cash: formatCash(paise) } });
const fail = (error: string): CallbackReply => ({ status: "fail", error, content: null });

export interface CallbackDeps {
  db: Database.Database;
  wallet: ProviderWallet;
  /** ASTECH_SECRET_KEY; null when not configured. */
  secretKey: string | null;
}

interface LogFields {
  method?: string | null;
  txId?: string | null;
  signatureValid: boolean;
  outcome: string;
  error?: string | null;
}

function writeLog(db: Database.Database, rawBody: string, f: LogFields) {
  try {
    db.prepare(
      `INSERT INTO ProviderCallbackLog
         (id, provider, method, providerTransactionId, signatureValid, httpStatus, outcome, error, bodyExcerpt, createdAt)
       VALUES (?, ?, ?, ?, ?, 200, ?, ?, ?, ?)`
    ).run(
      createId("pcb"),
      PROVIDER_ID,
      f.method ?? null,
      f.txId ?? null,
      f.signatureValid ? 1 : 0,
      f.outcome,
      f.error ?? null,
      rawBody.slice(0, 2000),
      new Date().toISOString()
    );
  } catch (e) {
    log.error("callback_log_write_failed", { message: e instanceof Error ? e.message : "unknown" });
  }
}

/**
 * Full callback pipeline:
 * verify signature -> validate payload -> identify player -> idempotency ->
 * atomic wallet op + ProviderTransaction + ProviderCallbackLog (ONE db
 * transaction) -> exact AS Tech envelope.
 */
export function handleAsTechCallback(rawBody: string, signatureHeader: string | null, deps: CallbackDeps): CallbackReply {
  const { db, wallet, secretKey } = deps;

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    writeLog(db, "", { signatureValid: false, outcome: "PAYLOAD_TOO_LARGE" });
    return fail("Payload too large");
  }
  if (!secretKey) {
    log.error("callback_secret_missing");
    writeLog(db, rawBody, { signatureValid: false, outcome: "NOT_CONFIGURED" });
    return fail("Callback not configured");
  }

  // 1) Signature over the RAW body, before any parsing.
  if (!verifySignature(secretKey, rawBody, signatureHeader)) {
    log.warn("callback_signature_invalid");
    writeLog(db, rawBody, { signatureValid: false, outcome: "SIGNATURE_INVALID" });
    return fail("Invalid signature");
  }

  // 2) Validate payload.
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    writeLog(db, rawBody, { signatureValid: true, outcome: "BAD_JSON" });
    return fail("Invalid JSON");
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    writeLog(db, rawBody, { signatureValid: true, outcome: "BAD_PAYLOAD", error: parsed.error.issues[0]?.message ?? "invalid" });
    return fail("Unknown cmd");
  }
  const p = parsed.data;
  const login = p.user_login || p.login || "";
  const txId = p.transaction_id || p.transactionId || "";
  const roundId = p.round_id || p.roundId || null;
  const gameId = p.game_id || p.gameId || null;
  const sessionId = p.session_id || null;
  const currency = (p.currency ?? WALLET_CURRENCY).toUpperCase();
  const base = { method: p.cmd, txId: txId || null, signatureValid: true };

  if (!login) {
    writeLog(db, rawBody, { ...base, outcome: "BAD_PAYLOAD", error: "user_login required" });
    return fail("user_login required");
  }
  if (currency !== WALLET_CURRENCY) {
    writeLog(db, rawBody, { ...base, outcome: "UNSUPPORTED_CURRENCY", error: currency });
    return fail("UNSUPPORTED_CURRENCY");
  }

  // 3) Identify the XArena player.
  const user = findUserByPlayerLogin(db, login);
  if (!user) {
    writeLog(db, rawBody, { ...base, outcome: "PLAYER_NOT_FOUND" });
    return fail("Player not found");
  }
  const blocked = user.status === "BANNED" || user.status === "SUSPENDED";

  try {
    switch (p.cmd) {
      case "getBalance": {
        if (blocked) {
          writeLog(db, rawBody, { ...base, outcome: "PLAYER_BLOCKED" });
          return fail("PLAYER_BLOCKED");
        }
        const bal = wallet.getBalance(user.id);
        writeLog(db, rawBody, { ...base, outcome: "BALANCE_OK" });
        return ok(bal);
      }

      case "writeBet": {
        if (!txId) {
          writeLog(db, rawBody, { ...base, outcome: "BAD_PAYLOAD", error: "transaction_id required" });
          return fail("transaction_id required");
        }
        const betPaise = decimalToPaise(p.bet, "bet");
        const winPaise = decimalToPaise(p.win, "win");
        if (blocked && betPaise > 0) {
          writeLog(db, rawBody, { ...base, outcome: "PLAYER_BLOCKED" });
          return fail("PLAYER_BLOCKED");
        }
        const rf = p.round_finished;
        const roundFinished = rf === true || rf === 1 || rf === "1" || rf === "true";

        // Wallet + ProviderTransaction + callback log commit or roll back TOGETHER.
        const run = db.transaction(() => {
          const result = wallet.applyRound({
            provider: PROVIDER_ID,
            providerTransactionId: txId,
            userId: user.id,
            providerGameId: gameId,
            roundId,
            currency,
            betPaise,
            winPaise,
            roundFinished,
            metadata: { sessionId },
          });
          writeLog(db, rawBody, { ...base, outcome: result.outcome });
          return result;
        });
        const result = run.immediate();
        log.info("write_bet", { outcome: result.outcome, txId, roundId, betPaise, winPaise });
        return ok(result.balancePaise);
      }

      case "rollback": {
        if (!txId) {
          writeLog(db, rawBody, { ...base, outcome: "BAD_PAYLOAD", error: "transaction_id required" });
          return fail("transaction_id required");
        }
        const run = db.transaction(() => {
          const result = wallet.rollback({ provider: PROVIDER_ID, providerTransactionId: txId, userId: user.id, currency });
          writeLog(db, rawBody, {
            ...base,
            outcome: `ROLLBACK_${result.outcome}`,
            error: result.unrecoveredPaise > 0 ? `unrecovered_paise=${result.unrecoveredPaise}` : null,
          });
          return result;
        });
        const result = run.immediate();
        if (result.unrecoveredPaise > 0) log.warn("rollback_unrecovered", { txId, unrecoveredPaise: result.unrecoveredPaise });
        return ok(result.balancePaise);
      }
    }
  } catch (e) {
    // The failed wallet transaction was rolled back in full; record why (outside it).
    if (e instanceof WalletError) {
      const code = e.code === "INSUFFICIENT_FUNDS" ? "INSUFFICIENT_FUNDS" : e.code;
      writeLog(db, rawBody, { ...base, outcome: code, error: e.message });
      log.warn("callback_rejected", { code, txId });
      return fail(code);
    }
    log.error("callback_error", { message: e instanceof Error ? e.message : "unknown", txId });
    writeLog(db, rawBody, { ...base, outcome: "INTERNAL_ERROR" });
    return fail("Internal error");
  }
  return fail("Unknown cmd");
}
