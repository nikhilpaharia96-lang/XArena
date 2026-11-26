/**
 * Referral programme. Every number lives here so it can be tuned in one place.
 * A referral is "qualified" (and pays) only once the friend has added real money.
 */
export const REFERRER_REWARD_PAISE = 10_000; // ₹100 to the person who invited
export const FRIEND_REWARD_PAISE = 5_000; //     ₹50 welcome bonus to the friend
export const MIN_QUALIFY_DEPOSIT_PAISE = 10_000; // friend's deposits must reach ₹100
export const DAILY_QUALIFIED_CAP = 10; //  max paid referrals per referrer per 24h
export const LIFETIME_QUALIFIED_CAP = 200; // max paid referrals per referrer

export interface ReferralMilestone {
  count: number;
  rewardPaise: number;
}

/** One-time bonus when the number of qualified friends reaches `count`. */
export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { count: 5, rewardPaise: 20_000 },
  { count: 10, rewardPaise: 50_000 },
  { count: 25, rewardPaise: 150_000 },
  { count: 50, rewardPaise: 400_000 },
];
