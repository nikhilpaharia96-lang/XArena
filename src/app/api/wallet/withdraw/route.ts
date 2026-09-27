import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
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

    const now = new Date().toISOString();
    const withdrawId = createId("wd");

    db.transaction(() => {
      db.prepare(
        `UPDATE Wallet SET winningBalance = winningBalance - ?, lockedBalance = lockedBalance + ?, updatedAt = ? WHERE userId = ?`
      ).run(amountPaise, amountPaise, now, user.id);

      db.prepare(
        `INSERT INTO WithdrawRequest (id, userId, amount, status, upiId, createdAt)
         VALUES (?, ?, ?, 'PENDING', ?, ?)`
      ).run(withdrawId, user.id, amountPaise, input.upiId, now);
    })();

    return ok({ requestId: withdrawId, status: "PENDING" }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
