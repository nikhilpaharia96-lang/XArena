import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    const fullUser = db
      .prepare(
        `SELECT id, uid, email, username, displayName, avatarUrl, role, status, referralCode, createdAt
         FROM User WHERE id = ?`
      )
      .get(user.id);

    const wallet = db
      .prepare("SELECT depositBalance, winningBalance, bonusBalance, lockedBalance FROM Wallet WHERE userId = ?")
      .get(user.id);

    const stats = db
      .prepare(
        `SELECT matchesPlayed, wins, losses, kills, headshots, totalEarnings, currentStreak, bestRank
         FROM PlayerStats WHERE userId = ?`
      )
      .get(user.id);

    return ok({ user: fullUser, wallet, stats });
  } catch (error) {
    return fail(error);
  }
}
