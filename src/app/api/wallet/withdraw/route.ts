import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { withdrawSchema } from "@/types/schemas";
import { rupeesToPaise } from "@/server/lib/money";

interface WalletRow {
  winningBalance: number;
  lockedBalance: number;
}

/**
 * Withdrawals are only ever paid from `winningBalance` (deposit balance is
 * a play-only credit line by policy — matches how Gamezy/GamerJi-style
 * platforms structure this to satisfy Indian real-money-gaming
 * regulations around "own money" vs "winnings"). The requested amount is
 * moved into `lockedBalance` immediately so it can't be spent joining a
 * tournament while the withdrawal is pending admin review — see the admin
 * approve/reject endpoints for what happens to the locked amount next.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`withdraw:${getClientKey(req)}:${user.id}`, 5, 60_000);
    if (!allowed) {
      throw new ApiError(429, "Too many requests. Please slow down.");
    }

    const body = await req.json();
    const input = withdrawSchema.parse(body);
    const amountPaise = rupeesToPaise(input.amountRupees);

    const wallet = db
      .prepare("SELECT winningBalance, lockedBalance FROM Wallet WHERE userId = ?")
      .get(user.id) as WalletRow;

    if (wallet.winningBalance < amountPaise) {
      throw new ApiError(
        402,
        "Insufficient winning balance. Only prize winnings can be withdrawn.",
        "INSUFFICIENT_BALANCE"
      );
    }

    // Resolve the payout destination. A bank is looked up server-side by id + owner,
    // so a client can never withdraw into someone else's saved account.
    let bank: { id: string; ifsc: string; bankName: string; accountNumber: string; accountHolder: string } | undefined;
    if (input.bankId) {
      bank = db
        .prepare("SELECT id, ifsc, bankName, accountNumber, accountHolder FROM BankAccount WHERE id = ? AND userId = ?")
        .get(input.bankId, user.id) as typeof bank;
      if (!bank) throw new ApiError(404, "Selected bank account was not found.", "BANK_NOT_FOUND");
    }

    const now = new Date().toISOString();
    const withdrawId = createId("wd");

    db.transaction(() => {
      // Guarded UPDATE: the balance check and the debit happen atomically.
      const res = db
        .prepare(
          `UPDATE Wallet SET winningBalance = winningBalance - ?, lockedBalance = lockedBalance + ?, updatedAt = ?
           WHERE userId = ? AND winningBalance >= ?`
        )
        .run(amountPaise, amountPaise, now, user.id, amountPaise);
      if (res.changes === 0) {
        throw new ApiError(402, "Insufficient winning balance. Only prize winnings can be withdrawn.", "INSUFFICIENT_BALANCE");
      }

      db.prepare(
        `INSERT INTO WithdrawRequest (id, userId, amount, status, upiId, bankAccount, ifsc, bankName, accountHolder, createdAt)
         VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?)`
      ).run(
        withdrawId,
        user.id,
        amountPaise,
        bank ? null : input.upiId ?? null,
        bank?.accountNumber ?? null,
        bank?.ifsc ?? null,
        bank?.bankName ?? null,
        bank?.accountHolder ?? null,
        now
      );
    })();

    return ok({ requestId: withdrawId, status: "PENDING" }, 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
