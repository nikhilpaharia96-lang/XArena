import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import { VIP_LEVELS, expFromPaise, istMonth, levelForExp, vipLevel } from "@/lib/vip";

type Db = Database.Database;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Amount wagered: tournament entry fees + game bets, net of refunds and rollbacks. */
const WAGER_SQL = `COALESCE(SUM(CASE
  WHEN type IN ('TOURNAMENT_ENTRY','GAME_BET') THEN amount
  WHEN type IN ('REFUND','GAME_ROLLBACK') THEN -amount
  ELSE 0 END), 0)`;

/** Lifetime wagering up to (not including) `beforeIso`, or all of it. */
export function wageredTotal(db: Db, userId: string, beforeIso?: string): number {
  const row = (beforeIso
    ? db.prepare(`SELECT ${WAGER_SQL} s FROM "Transaction" WHERE userId = ? AND status = 'COMPLETED' AND createdAt < ?`).get(userId, beforeIso)
    : db.prepare(`SELECT ${WAGER_SQL} s FROM "Transaction" WHERE userId = ? AND status = 'COMPLETED'`).get(userId)) as { s: number };
  return Math.max(0, row.s);
}

export function wageredInRange(db: Db, userId: string, startIso: string, endIso: string): number {
  const row = db
    .prepare(`SELECT ${WAGER_SQL} s FROM "Transaction" WHERE userId = ? AND status = 'COMPLETED' AND createdAt >= ? AND createdAt < ?`)
    .get(userId, startIso, endIso) as { s: number };
  return Math.max(0, row.s);
}

/** Pays one reward into the bonus wallet, once (unique key). */
function grant(db: Db, o: { userId: string; kind: "LEVEL" | "MONTHLY" | "REBATE"; key: string; amount: number; description: string; now: string }): boolean {
  if (o.amount <= 0) return false;
  const rewardId = createId("vip");
  const ins = db
    .prepare(`INSERT OR IGNORE INTO VipReward (id, userId, kind, rewardKey, amount, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(rewardId, o.userId, o.kind, o.key, o.amount, o.now);
  if (ins.changes === 0) return false;

  db.prepare("UPDATE Wallet SET bonusBalance = bonusBalance + ?, updatedAt = ? WHERE userId = ?").run(o.amount, o.now, o.userId);
  const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(o.userId) as {
    depositBalance: number; winningBalance: number; bonusBalance: number;
  };
  const txnId = createId("txn");
  db.prepare(
    `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
     VALUES (?, ?, 'BONUS_CREDIT', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
  ).run(txnId, o.userId, o.amount, w.depositBalance + w.winningBalance + w.bonusBalance, `VIP-${o.kind}-${o.userId}-${o.key}`, o.description, JSON.stringify({ vip: o.kind, key: o.key }), o.now);
  db.prepare("UPDATE VipReward SET transactionId = ? WHERE id = ?").run(txnId, rewardId);
  return true;
}

/**
 * Settles every finished month that is past its 2:00 AM (IST) settlement time and has not been paid.
 * For each month: level at month end (from lifetime EXP then), level-up rewards for newly reached
 * levels, the monthly reward (if you wagered that month) and the rebate on that month's wagering.
 * Idempotent and safe to call often. Never throws into the caller.
 */
export function settleVipRewards(db: Db, userId: string, now = new Date()): void {
  try {
    const months = db
      .prepare(`SELECT DISTINCT strftime('%Y-%m', createdAt, '+330 minutes') m FROM "Transaction"
                WHERE userId = ? AND status = 'COMPLETED' AND type IN ('TOURNAMENT_ENTRY','GAME_BET') ORDER BY m`)
      .all(userId) as { m: string }[];
    for (const { m } of months) {
      const [y, mo] = m.split("-").map(Number);
      // Any instant inside the month: noon IST on the 15th.
      const info = istMonth(new Date(Date.UTC(y, mo - 1, 15, 6, 30)));
      if (now.toISOString() < info.settleAtIso) continue; // not due yet
      db.transaction(() => {
        const paidNow = db.prepare("SELECT COUNT(*) c FROM VipReward WHERE userId = ? AND kind IN ('MONTHLY','REBATE') AND rewardKey = ?").get(userId, m) as { c: number };
        const settleIso = now.toISOString();
        const level = levelForExp(expFromPaise(wageredTotal(db, userId, info.endIso)));
        let total = 0;
        const parts: string[] = [];
        for (const l of VIP_LEVELS) {
          if (l.level > level) break;
          if (grant(db, { userId, kind: "LEVEL", key: String(l.level), amount: l.levelUpRewardPaise, now: settleIso, description: `VIP ${l.level} level-up reward` })) {
            total += l.levelUpRewardPaise;
            parts.push(`VIP ${l.level} level-up ${rupees(l.levelUpRewardPaise)}`);
          }
        }
        const cur = vipLevel(level);
        if (cur && paidNow.c < 2) {
          const wagered = wageredInRange(db, userId, info.startIso, info.endIso);
          if (wagered > 0) {
            if (grant(db, { userId, kind: "MONTHLY", key: m, amount: cur.monthlyRewardPaise, now: settleIso, description: `VIP ${level} monthly reward · ${info.label}` })) {
              total += cur.monthlyRewardPaise;
              parts.push(`monthly reward ${rupees(cur.monthlyRewardPaise)}`);
            }
            const rebate = Math.floor((wagered * cur.rebateBps) / 10_000);
            if (grant(db, { userId, kind: "REBATE", key: m, amount: rebate, now: settleIso, description: `VIP ${level} rebate (${cur.rebateBps / 100}% of ${rupees(wagered)}) · ${info.label}` })) {
              total += rebate;
              parts.push(`rebate ${rupees(rebate)}`);
            }
          }
        }
        if (total > 0) {
          db.prepare(`INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'VIP_REWARD', ?, ?, ?)`).run(
            createId("notif"), userId, `VIP rewards for ${info.label}`, `${rupees(total)} added to your bonus balance: ${parts.join(", ")}.`, settleIso
          );
        }
      })();
    }
  } catch (err) {
    console.error("[vip] settlement failed:", err);
  }
}

/** Settle at most once per user per hour per process; this is called from frequently-hit endpoints. */
const lastChecked = new Map<string, number>();
export function settleVipRewardsThrottled(db: Db, userId: string, now = new Date()): void {
  const last = lastChecked.get(userId) ?? 0;
  if (now.getTime() - last < 3_600_000) return;
  lastChecked.set(userId, now.getTime());
  settleVipRewards(db, userId, now);
}

export interface VipSummary {
  exp: number;
  level: number;
  next: { level: number; expRequired: number; expToNext: number; levelUpRewardPaise: number } | null;
  progressPct: number;
  levels: { level: number; expRequired: number; levelUpRewardPaise: number; monthlyRewardPaise: number; rebateBps: number; reached: boolean; paid: boolean }[];
  month: {
    key: string; label: string; wageredPaise: number; exp: number; settleLabel: string;
    expectedRebatePaise: number; expectedMonthlyPaise: number;
  };
  earnedPaise: number;
  recent: { kind: string; label: string; amount: number; createdAt: string }[];
}

export function vipSummary(db: Db, userId: string, now = new Date()): VipSummary {
  const exp = expFromPaise(wageredTotal(db, userId));
  const level = levelForExp(exp);
  const cur = vipLevel(level);
  const nextLvl = vipLevel(level + 1);
  const prevReq = cur?.expRequired ?? 0;
  const progressPct = nextLvl ? Math.min(100, ((exp - prevReq) / (nextLvl.expRequired - prevReq)) * 100) : 100;

  const rows = db.prepare("SELECT kind, rewardKey, amount, createdAt FROM VipReward WHERE userId = ? ORDER BY createdAt DESC, rewardKey DESC").all(userId) as {
    kind: string; rewardKey: string; amount: number; createdAt: string;
  }[];
  const paidLevels = new Set(rows.filter((r) => r.kind === "LEVEL").map((r) => Number(r.rewardKey)));

  const month = istMonth(now);
  const monthWager = wageredInRange(db, userId, month.startIso, month.endIso);

  return {
    exp,
    level,
    next: nextLvl ? { level: nextLvl.level, expRequired: nextLvl.expRequired, expToNext: nextLvl.expRequired - exp, levelUpRewardPaise: nextLvl.levelUpRewardPaise } : null,
    progressPct,
    levels: VIP_LEVELS.map((l) => ({ ...l, reached: exp >= l.expRequired, paid: paidLevels.has(l.level) })),
    month: {
      key: month.key, label: month.label, wageredPaise: monthWager, exp: expFromPaise(monthWager), settleLabel: month.settleLabel,
      expectedRebatePaise: cur ? Math.floor((monthWager * cur.rebateBps) / 10_000) : 0,
      expectedMonthlyPaise: cur && monthWager > 0 ? cur.monthlyRewardPaise : 0,
    },
    earnedPaise: rows.reduce((a, r) => a + r.amount, 0),
    recent: rows.slice(0, 8).map((r) => ({
      kind: r.kind,
      label: r.kind === "LEVEL" ? `VIP ${r.rewardKey} level-up reward` : `${r.kind === "MONTHLY" ? "Monthly reward" : "Rebate"} · ${r.rewardKey}`,
      amount: r.amount,
      createdAt: r.createdAt,
    })),
  };
}
