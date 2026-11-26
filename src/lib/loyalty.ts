/**
 * XArena Rewards: shared (server + client) tier and target tables.
 * XP is earned only from approved deposits: Rs 1 deposited = 1 XP.
 * Rewards are credited to the BONUS wallet (play-only, never directly withdrawable).
 * All money is paise.
 */
export interface LoyaltyLevel { name: string; minXp: number; rewardPaise: number }

export const LEVELS: readonly LoyaltyLevel[] = [
  { name: "Bronze I", minXp: 0, rewardPaise: 0 },
  { name: "Bronze II", minXp: 2_000, rewardPaise: 2_000 },
  { name: "Bronze III", minXp: 5_000, rewardPaise: 5_000 },
  { name: "Silver I", minXp: 10_000, rewardPaise: 10_000 },
  { name: "Silver II", minXp: 20_000, rewardPaise: 20_000 },
  { name: "Silver III", minXp: 35_000, rewardPaise: 35_000 },
  { name: "Gold I", minXp: 60_000, rewardPaise: 60_000 },
  { name: "Gold II", minXp: 100_000, rewardPaise: 100_000 },
  { name: "Gold III", minXp: 150_000, rewardPaise: 150_000 },
  { name: "Platinum", minXp: 250_000, rewardPaise: 250_000 },
  { name: "Diamond", minXp: 500_000, rewardPaise: 500_000 },
];

/** Monthly deposit targets (calendar month, India time) and the rebate for hitting each. */
export interface MonthlyTarget { targetPaise: number; rewardPaise: number }
export const MONTHLY_TARGETS: readonly MonthlyTarget[] = [
  { targetPaise: 200_000, rewardPaise: 2_000 },
  { targetPaise: 1_000_000, rewardPaise: 12_000 },
  { targetPaise: 5_000_000, rewardPaise: 75_000 },
];

export const xpFromPaise = (paise: number) => Math.floor(paise / 100);

export function levelIndexForXp(xp: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].minXp) idx = i;
  return idx;
}

const IST_MS = 330 * 60_000;

/** The IST calendar month containing `at`: key ("2026-11"), label, and its UTC instants. */
export function istMonth(at: Date) {
  const shifted = new Date(at.getTime() + IST_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1) - IST_MS);
  const end = new Date(Date.UTC(y, m + 1, 1) - IST_MS);
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    label: new Date(Date.UTC(y, m, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
