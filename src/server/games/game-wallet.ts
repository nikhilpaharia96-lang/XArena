import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import { allocateProRata, type BucketSplit } from "@/server/providers/provider-wallet";
import { GameError } from "./errors";

/**
 * Wallet side of the in-house games. Same accounting rules as the AS Tech
 * seamless wallet, applied to XArena's own Wallet / "Transaction" tables:
 *   - stake is taken bonus -> deposit -> winning
 *   - on a win, the stake part of the payout returns to the buckets it came
 *     from (pro rata); ONLY profit lands in winningBalance (withdrawable)
 *   - lockedBalance is never touched; no bucket can go negative
 *
 * These functions assume the CALLER is inside a database transaction.
 */

interface WalletRow {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
}

const total = (w: WalletRow) => w.depositBalance + w.winningBalance + w.bonusBalance;

function readWallet(db: Database.Database, userId: string): WalletRow {
  const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(userId) as WalletRow | undefined;
  if (!w) throw new GameError("WALLET_NOT_FOUND", "Wallet not found.");
  return w;
}

function writeWallet(db: Database.Database, userId: string, w: WalletRow, nowIso: string) {
  if (w.depositBalance < 0 || w.winningBalance < 0 || w.bonusBalance < 0) {
    throw new GameError("INSUFFICIENT_FUNDS", "Insufficient balance.");
  }
  db.prepare("UPDATE Wallet SET depositBalance = ?, winningBalance = ?, bonusBalance = ?, updatedAt = ? WHERE userId = ?").run(
    w.depositBalance,
    w.winningBalance,
    w.bonusBalance,
    nowIso,
    userId
  );
}

function ledger(
  db: Database.Database,
  p: { userId: string; type: "GAME_BET" | "GAME_WIN" | "REFUND"; amount: number; balanceAfter: number; ref: string; description: string; meta: Record<string, unknown>; nowIso: string }
) {
  db.prepare(
    `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
     VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?)`
  ).run(createId("txn"), p.userId, p.type, p.amount, p.balanceAfter, p.ref, p.description, JSON.stringify(p.meta), p.nowIso);
}

export function currentBalance(db: Database.Database, userId: string): number {
  return total(readWallet(db, userId));
}

/** Take the stake out of the wallet. Returns where it came from (needed to settle correctly). */
export function debitStake(
  db: Database.Database,
  p: { userId: string; roundId: string; gameKey: string; stake: number; nowIso: string }
): { debit: BucketSplit; balanceAfter: number } {
  const w = readWallet(db, p.userId);
  if (total(w) < p.stake) throw new GameError("INSUFFICIENT_FUNDS", "Insufficient balance.");

  let remaining = p.stake;
  const debit: BucketSplit = { bonus: 0, deposit: 0, winning: 0 };
  debit.bonus = Math.min(w.bonusBalance, remaining);
  remaining -= debit.bonus;
  debit.deposit = Math.min(w.depositBalance, remaining);
  remaining -= debit.deposit;
  debit.winning = Math.min(w.winningBalance, remaining);
  remaining -= debit.winning;

  const next: WalletRow = {
    bonusBalance: w.bonusBalance - debit.bonus,
    depositBalance: w.depositBalance - debit.deposit,
    winningBalance: w.winningBalance - debit.winning,
  };
  writeWallet(db, p.userId, next, p.nowIso);
  const balanceAfter = total(next);
  ledger(db, {
    userId: p.userId,
    type: "GAME_BET",
    amount: p.stake,
    balanceAfter,
    ref: `GAME-${p.roundId}-BET`,
    description: `${p.gameKey} bet`,
    meta: { game: p.gameKey, roundId: p.roundId, debit },
    nowIso: p.nowIso,
  });
  return { debit, balanceAfter };
}

/** Pay a winning round. Stake part -> original buckets, profit -> winningBalance. */
export function creditPayout(
  db: Database.Database,
  p: { userId: string; roundId: string; gameKey: string; stake: number; payout: number; debit: BucketSplit; nowIso: string; kind?: "WIN" | "REFUND" }
): number {
  const w = readWallet(db, p.userId);
  const stakeBack = Math.min(p.payout, p.stake);
  const profit = p.payout - stakeBack;
  const credit = allocateProRata(stakeBack, p.debit);
  credit.winning += profit;
  const next: WalletRow = {
    bonusBalance: w.bonusBalance + credit.bonus,
    depositBalance: w.depositBalance + credit.deposit,
    winningBalance: w.winningBalance + credit.winning,
  };
  writeWallet(db, p.userId, next, p.nowIso);
  const balanceAfter = total(next);
  ledger(db, {
    userId: p.userId,
    type: p.kind === "REFUND" ? "REFUND" : "GAME_WIN",
    amount: p.payout,
    balanceAfter,
    ref: `GAME-${p.roundId}-${p.kind === "REFUND" ? "REFUND" : "WIN"}`,
    description: p.kind === "REFUND" ? `${p.gameKey} round voided - stake refunded` : `${p.gameKey} win`,
    meta: { game: p.gameKey, roundId: p.roundId, stakeReturned: stakeBack, profit },
    nowIso: p.nowIso,
  });
  return balanceAfter;
}
