import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { referralSummary } from "@/server/lib/referral";
import { FRIEND_REWARD_PAISE, MIN_QUALIFY_DEPOSIT_PAISE, REFERRER_REWARD_PAISE } from "@/lib/referral";

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

    const s = referralSummary(db, user.id);

    return ok({
      referralCode: userRow.referralCode,
      referralLink: `https://xarena.app/signup?ref=${userRow.referralCode}`,
      invites,
      totalInvites: s.qualified + s.pending,
      totalEarned: s.earnedPaise,
      qualified: s.qualified,
      pending: s.pending,
      milestones: s.milestones,
      config: { referrerRewardPaise: REFERRER_REWARD_PAISE, friendRewardPaise: FRIEND_REWARD_PAISE, minDepositPaise: MIN_QUALIFY_DEPOSIT_PAISE },
    });
  } catch (error) {
    return fail(error);
  }
}
