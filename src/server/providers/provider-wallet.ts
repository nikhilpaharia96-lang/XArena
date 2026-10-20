import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";

/**
 * Provider-agnostic seamless-wallet engine.
 *
 * XArena's own Wallet / "Transaction" tables remain the single source of truth —
 * this module only applies provider settlements to them, atomically and
 * idempotently. All amounts are INTEGER PAISE (same as the rest of the app).
 *
 * Atomicity: every operation runs inside `BEGIN IMMEDIATE`, which takes the
 * SQLite write lock up-front, so the read-balance → write-balance sequence
 * cannot interleave with another request (even from another process).
 * Idempotency: UNIQUE(provider, providerTransactionId) on ProviderTransaction
 * is the hard backstop; we also pre-check so duplicates return cleanly.
 */

export type WalletErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "WALLET_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "TRANSACTION_CONFLICT";

export class WalletError extends Error {
  constructor(public code: WalletErrorCode, message: string) {
    super(message);
    this.name = "WalletError";
  }
}

export interface ApplyRoundInput {
  provider: string;
  providerTransactionId: string;
  userId: string;
  providerGameId?: string | null;
  roundId?: string | null;
  currency: string;
  /** Integer paise, >= 0 */
  betPaise: number;
  /** Integer paise, >= 0 */
  winPaise: number;
  roundFinished: boolean;
  metadata?: Record<string, unknown>;
}

export type ApplyOutcome = "APPLIED" | "DUPLICATE" | "IGNORED_ROLLED_BACK";

export interface ApplyResult {
  outcome: ApplyOutcome;
  balancePaise: number;
}

export interface RollbackInput {
  provider: string;
  /** The provider transaction id being rolled back. */
  providerTransactionId: string;
  userId: string;
  currency: string;
}

export type RollbackOutcome = "ROLLED_BACK" | "DUPLICATE" | "TOMBSTONED";

export interface RollbackResult {
  outcome: RollbackOutcome;
  balancePaise: number;
  /** Paise that could not be reversed because the player already spent it (needs reconciliation). */
  unrecoveredPaise: number;
}

interface WalletRow {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
}

interface PtxnRow {
  id: string;
  userId: string;
  betAmount: number;
  winAmount: number;
  status: string;
  balanceAfter: number | null;
  metadata: string | null;
}

export interface BucketSplit {
  bonus: number;
  deposit: number;
  winning: number;
}

const MAX_PAISE = 1_000_000_000_00; // 1e9 rupees — sanity cap against corrupt/hostile payloads

export function assertPaise(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_PAISE) {
    throw new WalletError("INVALID_AMOUNT", `${label} must be a non-negative integer paise amount`);
  }
}

/**
 * Split `amount` across the buckets in proportion to `weights` using the
 * largest-remainder method so the parts always sum exactly to `amount`.
 */
export function allocateProRata(amount: number, weights: BucketSplit): BucketSplit {
  const sum = weights.bonus + weights.deposit + weights.winning;
  const out: BucketSplit = { bonus: 0, deposit: 0, winning: 0 };
  if (amount <= 0 || sum <= 0) return out;
  const keys = ["bonus", "deposit", "winning"] as const;
  const exact = keys.map((k) => (amount * weights[k]) / sum);
  const floors = exact.map(Math.floor);
  let left = amount - floors.reduce((a, b) => a + b, 0);
  const order = keys
    .map((k, i) => ({ k, i, frac: exact[i] - floors[i] }))
    .filter((x) => weights[x.k] > 0)
    .sort((a, b) => b.frac - a.frac);
  keys.forEach((k, i) => (out[k] = floors[i]));
  for (let n = 0; left > 0 && order.length > 0; n = (n + 1) % order.length, left--) out[order[n].k] += 1;
  return out;
}

const total = (w: WalletRow) => w.depositBalance + w.winningBalance + w.bonusBalance;

export function createProviderWallet(database: Database.Database) {
  const readWallet = (userId: string): WalletRow => {
    const w = database
      .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
      .get(userId) as WalletRow | undefined;
    if (!w) throw new WalletError("WALLET_NOT_FOUND", "Wallet not found");
    return w;
  };

  const writeWallet = (userId: string, w: WalletRow, nowIso: string) => {
    if (w.depositBalance < 0 || w.winningBalance < 0 || w.bonusBalance < 0) {
      // Defence in depth: never persist a negative bucket.
      throw new WalletError("INSUFFICIENT_FUNDS", "Operation would make a balance negative");
    }
    database
      .prepare("UPDATE Wallet SET depositBalance = ?, winningBalance = ?, bonusBalance = ?, updatedAt = ? WHERE userId = ?")
      .run(w.depositBalance, w.winningBalance, w.bonusBalance, nowIso, userId);
  };

  const insertLedger = (
    userId: string,
    type: string,
    amount: number,
    balanceAfter: number,
    referenceId: string,
    description: string,
    metadata: Record<string, unknown>,
    nowIso: string
  ) => {
    database
      .prepare(
        `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
         VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)`
      )
      .run(createId("txn"), userId, type, amount, balanceAfter, referenceId, description, JSON.stringify(metadata), nowIso);
  };

  const findPtxn = (provider: string, providerTransactionId: string) =>
    database
      .prepare(
        `SELECT id, userId, betAmount, winAmount, status, balanceAfter, metadata
         FROM ProviderTransaction WHERE provider = ? AND providerTransactionId = ?`
      )
      .get(provider, providerTransactionId) as PtxnRow | undefined;

  /** Current spendable balance in paise (deposit + winning + bonus). */
  function getBalance(userId: string): number {
    return total(readWallet(userId));
  }

  /**
   * Apply one provider settlement: debit `bet`, then credit `win`, as ONE
   * atomic unit — a completed round arriving as bet+win(+round_finished) is a
   * single transaction, never two independent balance deductions.
   */
  function applyRound(input: ApplyRoundInput): ApplyResult {
    assertPaise(input.betPaise, "bet");
    assertPaise(input.winPaise, "win");
    if (!input.providerTransactionId) throw new WalletError("INVALID_AMOUNT", "transaction id required");

    const run = database.transaction((): ApplyResult => {
      const existing = findPtxn(input.provider, input.providerTransactionId);
      if (existing) {
        if (existing.status === "ROLLED_BACK") {
          return { outcome: "IGNORED_ROLLED_BACK", balancePaise: total(readWallet(existing.userId)) };
        }
        if (
          existing.userId !== input.userId ||
          existing.betAmount !== input.betPaise ||
          existing.winAmount !== input.winPaise
        ) {
          // Same id, different content: refuse rather than guess.
          throw new WalletError("TRANSACTION_CONFLICT", "Transaction id reused with a different payload");
        }
        return { outcome: "DUPLICATE", balancePaise: existing.balanceAfter ?? total(readWallet(existing.userId)) };
      }

      const nowIso = new Date().toISOString();
      const wallet = readWallet(input.userId);

      if (total(wallet) < input.betPaise) {
        throw new WalletError("INSUFFICIENT_FUNDS", "Insufficient wallet balance");
      }

      // ACCOUNTING POLICY (matches existing XArena rules):
      //  - Bet debit order mirrors tournament entry: bonus -> deposit -> winning.
      //  - Withdrawals are paid ONLY from winningBalance and deposit money is
      //    "play-only", so a win must not turn deposit/bonus stake into
      //    withdrawable money. The stake portion of a win (min(win, bet)) is
      //    therefore returned to the buckets the bet was taken from, pro rata;
      //    only PROFIT (win - bet, if positive) is credited to winningBalance.
      let remaining = input.betPaise;
      const debit: BucketSplit = { bonus: 0, deposit: 0, winning: 0 };
      debit.bonus = Math.min(wallet.bonusBalance, remaining);
      remaining -= debit.bonus;
      debit.deposit = Math.min(wallet.depositBalance, remaining);
      remaining -= debit.deposit;
      debit.winning = Math.min(wallet.winningBalance, remaining);
      remaining -= debit.winning;

      const stakeBack = Math.min(input.winPaise, input.betPaise);
      const profit = input.winPaise - stakeBack;
      const credit = allocateProRata(stakeBack, debit);
      credit.winning += profit;

      const next: WalletRow = {
        bonusBalance: wallet.bonusBalance - debit.bonus + credit.bonus,
        depositBalance: wallet.depositBalance - debit.deposit + credit.deposit,
        winningBalance: wallet.winningBalance - debit.winning + credit.winning,
      };
      const afterBet = total(wallet) - input.betPaise;
      const finalBalance = total(next);

      writeWallet(input.userId, next, nowIso);

      const prefix = input.provider.toUpperCase();
      const meta = { provider: input.provider, providerTransactionId: input.providerTransactionId, roundId: input.roundId ?? null, providerGameId: input.providerGameId ?? null };
      if (input.betPaise > 0) {
        insertLedger(input.userId, "GAME_BET", input.betPaise, afterBet, `${prefix}-${input.providerTransactionId}-BET`, "Casino game bet", meta, nowIso);
      }
      if (input.winPaise > 0) {
        insertLedger(input.userId, "GAME_WIN", input.winPaise, finalBalance, `${prefix}-${input.providerTransactionId}-WIN`, "Casino game win", { ...meta, stakeReturned: stakeBack, profit }, nowIso);
      }

      database
        .prepare(
          `INSERT INTO ProviderTransaction
             (id, provider, providerTransactionId, userId, providerGameId, roundId, betAmount, winAmount, currency,
              status, roundFinished, balanceAfter, metadata, createdAt, processedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPLIED', ?, ?, ?, ?, ?)`
        )
        .run(
          createId("ptx"),
          input.provider,
          input.providerTransactionId,
          input.userId,
          input.providerGameId ?? null,
          input.roundId ?? null,
          input.betPaise,
          input.winPaise,
          input.currency,
          input.roundFinished ? 1 : 0,
          finalBalance,
          JSON.stringify({ ...(input.metadata ?? {}), debit, credit, profit }),
          nowIso,
          nowIso
        );

      return { outcome: "APPLIED", balancePaise: finalBalance };
    });

    try {
      return run.immediate();
    } catch (e) {
      // Concurrent duplicate that slipped past the pre-check (e.g. another process): resolve idempotently.
      if (e instanceof Error && e.message.includes("UNIQUE constraint failed: ProviderTransaction")) {
        const existing = findPtxn(input.provider, input.providerTransactionId);
        if (existing) return { outcome: "DUPLICATE", balancePaise: existing.balanceAfter ?? total(readWallet(existing.userId)) };
      }
      throw e;
    }
  }

  /**
   * Roll back a previously applied transaction exactly (bet refunded to the
   * buckets it came from, win clawed back from winning balance).
   * If the original was never seen, a tombstone is stored so that a late
   * arrival of the original is NOT applied.
   */
  function rollback(input: RollbackInput): RollbackResult {
    const run = database.transaction((): RollbackResult => {
      const nowIso = new Date().toISOString();
      const existing = findPtxn(input.provider, input.providerTransactionId);

      if (existing && existing.userId !== input.userId) {
        throw new WalletError("TRANSACTION_CONFLICT", "Rollback user does not match original transaction");
      }

      if (!existing) {
        const wallet = readWallet(input.userId);
        database
          .prepare(
            `INSERT INTO ProviderTransaction
               (id, provider, providerTransactionId, userId, currency, status, balanceAfter, metadata, createdAt, processedAt)
             VALUES (?, ?, ?, ?, ?, 'ROLLED_BACK', ?, ?, ?, ?)`
          )
          .run(createId("ptx"), input.provider, input.providerTransactionId, input.userId, input.currency, total(wallet), JSON.stringify({ tombstone: true }), nowIso, nowIso);
        return { outcome: "TOMBSTONED", balancePaise: total(wallet), unrecoveredPaise: 0 };
      }

      if (existing.status === "ROLLED_BACK") {
        return { outcome: "DUPLICATE", balancePaise: total(readWallet(input.userId)), unrecoveredPaise: 0 };
      }

      const stored = existing.metadata
        ? (JSON.parse(existing.metadata) as { debit?: BucketSplit; credit?: BucketSplit })
        : {};
      const debit: BucketSplit = stored.debit ?? { bonus: 0, deposit: existing.betAmount, winning: 0 };
      const credit: BucketSplit = stored.credit ?? { bonus: 0, deposit: 0, winning: existing.winAmount };

      // Exact inverse of applyRound, bucket by bucket. If the player has since
      // spent part of what a win credited, we never push a bucket negative: the
      // shortfall is recorded for reconciliation instead.
      const wallet = readWallet(input.userId);
      let unrecovered = 0;
      const apply = (current: number, refund: number, reverse: number) => {
        const want = current + refund - reverse;
        if (want >= 0) return { value: want, short: 0 };
        return { value: 0, short: -want };
      };
      const b = apply(wallet.bonusBalance, debit.bonus, credit.bonus);
      const d = apply(wallet.depositBalance, debit.deposit, credit.deposit);
      const w = apply(wallet.winningBalance, debit.winning, credit.winning);
      unrecovered = b.short + d.short + w.short;

      const next: WalletRow = { bonusBalance: b.value, depositBalance: d.value, winningBalance: w.value };
      writeWallet(input.userId, next, nowIso);

      const refundTotal = debit.bonus + debit.deposit + debit.winning;
      const reverseTotal = Math.max(0, credit.bonus + credit.deposit + credit.winning - unrecovered);

      const prefix = input.provider.toUpperCase();
      const lm = { provider: input.provider, providerTransactionId: input.providerTransactionId };
      const afterRefund = total(wallet) + refundTotal;
      if (refundTotal > 0) {
        insertLedger(input.userId, "GAME_ROLLBACK", refundTotal, afterRefund, `${prefix}-${input.providerTransactionId}-RBK`, "Casino bet refunded (rollback)", lm, nowIso);
      }
      if (reverseTotal > 0) {
        insertLedger(input.userId, "GAME_WIN_REVERSAL", reverseTotal, total(next), `${prefix}-${input.providerTransactionId}-RBW`, "Casino win reversed (rollback)", lm, nowIso);
      }

      database
        .prepare("UPDATE ProviderTransaction SET status = 'ROLLED_BACK', balanceAfter = ?, processedAt = ?, metadata = ? WHERE id = ?")
        .run(total(next), nowIso, JSON.stringify({ ...stored, rolledBackAt: nowIso, unrecovered }), existing.id);

      return { outcome: "ROLLED_BACK", balancePaise: total(next), unrecoveredPaise: unrecovered };
    });
    return run.immediate();
  }

  return { getBalance, applyRound, rollback };
}

export type ProviderWallet = ReturnType<typeof createProviderWallet>;
