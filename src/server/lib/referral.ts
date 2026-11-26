import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import {
  DAILY_QUALIFIED_CAP, FRIEND_REWARD_PAISE, LIFETIME_QUALIFIED_CAP, MIN_QUALIFY_DEPOSIT_PAISE,
  REFERRAL_MILESTONES, REFERRER_REWARD_PAISE,
} from "@/lib/referral";

type Db = Database.Database;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** Adds play-only bonus balance, writes the ledger row and a notification. */
function credit(db: Db, o: { userId: string; amount: number; description: string; refId: string; title: string; body: string; now: string }): string {
  db.prepare("UPDATE Wallet SET bonusBalance = bonusBalance + ?, updatedAt = ? WHERE userId = ?").run(o.amount, o.now, o.userId);
  const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(o.userId) as {
    depositBalance: number; winningBalance: number; bonusBalance: number;
  };
  const txnId = createId("txn");
  db.prepare(
    `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
     VALUES (?, ?, 'REFERRAL_BONUS', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
  ).run(txnId, o.userId, o.amount, w.depositBalance + w.winningBalance + w.bonusBalance, o.refId, o.description, JSON.stringify({ referral: true }), o.now);
  db.prepare(`INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'REFERRAL_BONUS', ?, ?, ?)`).run(
    createId("notif"), o.userId, o.title, o.body, o.now
  );
  return txnId;
}

export function qualifiedCount(db: Db, referrerId: string): number {
  return (db.prepare("SELECT COUNT(*) c FROM Referral WHERE referrerId = ? AND bonusPaidAt IS NOT NULL").get(referrerId) as { c: number }).c;
}

/**
 * Call inside the deposit's own transaction, right after its DEPOSIT ledger row is inserted.
 * When an invited friend's deposits first reach the minimum, pays the referrer and the friend once,
 * then any milestone the referrer just reached. Guarded by caps and an ACTIVE referrer.
 * Never lets a failure undo the deposit: runs in a savepoint and is swallowed.
 */
export function awardReferralForDeposit(db: Db, userId: string, nowIso: string): void {
  try {
    db.transaction(() => {
      const ref = db.prepare("SELECT id, referrerId FROM Referral WHERE referredUserId = ? AND bonusPaidAt IS NULL").get(userId) as
        | { id: string; referrerId: string } | undefined;
      if (!ref) return;

      const dep = (db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM "Transaction" WHERE userId = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`).get(userId) as { s: number }).s;
      if (dep < MIN_QUALIFY_DEPOSIT_PAISE) return;

      const referrer = db.prepare("SELECT status, username FROM User WHERE id = ?").get(ref.referrerId) as { status: string; username: string } | undefined;
      if (!referrer || referrer.status !== "ACTIVE") return;

      const since = new Date(new Date(nowIso).getTime() - 24 * 3600_000).toISOString();
      const today = (db.prepare("SELECT COUNT(*) c FROM Referral WHERE referrerId = ? AND bonusPaidAt >= ?").get(ref.referrerId, since) as { c: number }).c;
      if (today >= DAILY_QUALIFIED_CAP || qualifiedCount(db, ref.referrerId) >= LIFETIME_QUALIFIED_CAP) return;

      // Single-use claim: only the call that flips bonusPaidAt pays.
      const claim = db.prepare("UPDATE Referral SET bonusAmount = ?, bonusPaidAt = ? WHERE id = ? AND bonusPaidAt IS NULL").run(REFERRER_REWARD_PAISE, nowIso, ref.id);
      if (claim.changes === 0) return;

      const friend = db.prepare("SELECT username FROM User WHERE id = ?").get(userId) as { username: string };
      credit(db, {
        userId: ref.referrerId, amount: REFERRER_REWARD_PAISE, now: nowIso, refId: `REF-${ref.id}-R`,
        description: `Referral reward: ${friend.username} added money`,
        title: "Referral reward credited! 🎉",
        body: `${friend.username} added money. ${rupees(REFERRER_REWARD_PAISE)} was added to your bonus balance.`,
      });
      credit(db, {
        userId, amount: FRIEND_REWARD_PAISE, now: nowIso, refId: `REF-${ref.id}-F`,
        description: "Welcome bonus for joining with a referral code",
        title: "Welcome bonus added",
        body: `${rupees(FRIEND_REWARD_PAISE)} was added to your bonus balance for joining with ${referrer.username}'s code.`,
      });

      const count = qualifiedCount(db, ref.referrerId);
      for (const m of REFERRAL_MILESTONES) {
        if (m.count > count) continue;
        const ins = db.prepare("INSERT OR IGNORE INTO ReferralReward (id, userId, rewardKey, amount, createdAt) VALUES (?, ?, ?, ?, ?)")
          .run(createId("rr"), ref.referrerId, `M${m.count}`, m.rewardPaise, nowIso);
        if (ins.changes === 0) continue;
        const txnId = credit(db, {
          userId: ref.referrerId, amount: m.rewardPaise, now: nowIso, refId: `REF-M${m.count}-${ref.referrerId}`,
          description: `Referral milestone: ${m.count} friends`,
          title: `${m.count} friends joined! 🏆`,
          body: `Milestone bonus ${rupees(m.rewardPaise)} was added to your bonus balance.`,
        });
        db.prepare("UPDATE ReferralReward SET transactionId = ? WHERE userId = ? AND rewardKey = ?").run(txnId, ref.referrerId, `M${m.count}`);
      }
    })();
  } catch (err) {
    console.error("[referral] reward failed (deposit unaffected):", err);
  }
}

export interface ReferralSummary {
  qualified: number;
  pending: number;
  earnedPaise: number;
  milestones: { count: number; rewardPaise: number; reached: boolean; paid: boolean }[];
}

export function referralSummary(db: Db, userId: string): ReferralSummary {
  const q = qualifiedCount(db, userId);
  const total = (db.prepare("SELECT COUNT(*) c FROM Referral WHERE referrerId = ?").get(userId) as { c: number }).c;
  const refEarn = (db.prepare("SELECT COALESCE(SUM(bonusAmount),0) s FROM Referral WHERE referrerId = ? AND bonusPaidAt IS NOT NULL").get(userId) as { s: number }).s;
  const msRows = db.prepare("SELECT rewardKey, amount FROM ReferralReward WHERE userId = ?").all(userId) as { rewardKey: string; amount: number }[];
  const paidKeys = new Set(msRows.map((r) => r.rewardKey));
  const msEarn = msRows.reduce((s, r) => s + r.amount, 0);
  return {
    qualified: q,
    pending: total - q,
    earnedPaise: refEarn + msEarn,
    milestones: REFERRAL_MILESTONES.map((m) => ({ ...m, reached: q >= m.count, paid: paidKeys.has(`M${m.count}`) })),
  };
}
