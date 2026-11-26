/**
 * XArena VIP (bet-based, separate from Rewards): shared (server + client) level table.
 *
 * EXP comes from betting: every Rs 1 wagered (tournament entry fees + in-house and casino game bets,
 * net of refunds) = 1 EXP. Rewards are settled once a month, at 2:00 AM India time on the 1st, and are
 * credited to the BONUS wallet (play-only, never directly withdrawable). All money is paise.
 */
export interface VipLevel {
  level: number;
  expRequired: number;
  /** One-time reward the first time the level is reached. */
  levelUpRewardPaise: number;
  /** Paid once per month if you wagered that month. */
  monthlyRewardPaise: number;
  /** Share of the month's wagering returned, in basis points (5 = 0.05%). */
  rebateBps: number;
}

const r = (rupees: number) => rupees * 100;

export const VIP_LEVELS: readonly VipLevel[] = [
  { level: 1, expRequired: 2_000, levelUpRewardPaise: r(20), monthlyRewardPaise: r(2), rebateBps: 5 },
  { level: 2, expRequired: 20_000, levelUpRewardPaise: r(100), monthlyRewardPaise: r(10), rebateBps: 6 },
  { level: 3, expRequired: 100_000, levelUpRewardPaise: r(400), monthlyRewardPaise: r(40), rebateBps: 8 },
  { level: 4, expRequired: 400_000, levelUpRewardPaise: r(1_500), monthlyRewardPaise: r(150), rebateBps: 10 },
  { level: 5, expRequired: 1_000_000, levelUpRewardPaise: r(4_000), monthlyRewardPaise: r(400), rebateBps: 12 },
  { level: 6, expRequired: 2_500_000, levelUpRewardPaise: r(10_000), monthlyRewardPaise: r(1_000), rebateBps: 15 },
  { level: 7, expRequired: 6_000_000, levelUpRewardPaise: r(25_000), monthlyRewardPaise: r(2_500), rebateBps: 18 },
  { level: 8, expRequired: 15_000_000, levelUpRewardPaise: r(60_000), monthlyRewardPaise: r(6_000), rebateBps: 22 },
  { level: 9, expRequired: 40_000_000, levelUpRewardPaise: r(150_000), monthlyRewardPaise: r(15_000), rebateBps: 26 },
  { level: 10, expRequired: 100_000_000, levelUpRewardPaise: r(400_000), monthlyRewardPaise: r(40_000), rebateBps: 30 },
];

export const expFromPaise = (paise: number) => Math.max(0, Math.floor(paise / 100));

/** 0 = not unlocked yet; otherwise 1..10. */
export function levelForExp(exp: number): number {
  let lvl = 0;
  for (const l of VIP_LEVELS) if (exp >= l.expRequired) lvl = l.level;
  return lvl;
}

export const vipLevel = (level: number): VipLevel | undefined => VIP_LEVELS[level - 1];

const IST_MS = 330 * 60_000;
const SETTLE_HOUR_IST = 2;

/** The IST calendar month containing `at`: key ("2026-11"), label, its UTC bounds, and when it settles. */
export function istMonth(at: Date) {
  const shifted = new Date(at.getTime() + IST_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - IST_MS);
  const end = new Date(Date.UTC(y, m + 1, 1) - IST_MS);
  const settleAt = new Date(end.getTime() + SETTLE_HOUR_IST * 3_600_000);
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    label: new Date(Date.UTC(y, m, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    settleAtIso: settleAt.toISOString(),
    /** e.g. "1 Dec, 2:00 AM" */
    settleLabel: `${new Date(Date.UTC(y, m + 1, 1)).toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}, 2:00 AM`,
  };
}
