import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    const userRow = db.prepare("SELECT referralCode FROM User WHERE id = ?").get(user.id) as {
      referralCode: string;
    };

    const invites = db
      .prepare(
        `SELECT r.id, r.bonusAmount, r.bonusPaidAt, r.createdAt, u.username, u.avatarUrl
         FROM Referral r JOIN User u ON u.id = r.referredUserId
         WHERE r.referrerId = ? ORDER BY r.createdAt DESC`
      )
      .all(user.id);

    const totals = db
      .prepare(
        `SELECT COUNT(*) as totalInvites, COALESCE(SUM(bonusAmount), 0) as totalEarned
         FROM Referral WHERE referrerId = ?`
      )
      .get(user.id);

    return ok({
      referralCode: userRow.referralCode,
      referralLink: `https://xarena.app/signup?ref=${userRow.referralCode}`,
      invites,
      ...(totals as object),
    });
  } catch (error) {
    return fail(error);
  }
}
