import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    const wallet = db
      .prepare("SELECT depositBalance, winningBalance, bonusBalance, lockedBalance FROM Wallet WHERE userId = ?")
      .get(user.id) as {
      depositBalance: number;
      winningBalance: number;
      bonusBalance: number;
      lockedBalance: number;
    };

    const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;

    const pendingWithdrawals = db
      .prepare("SELECT COUNT(*) as count FROM WithdrawRequest WHERE userId = ? AND status = 'PENDING'")
      .get(user.id) as { count: number };

    return ok({
      ...wallet,
      totalBalance: total,
      pendingWithdrawals: pendingWithdrawals.count,
    });
  } catch (error) {
    return fail(error);
  }
}
