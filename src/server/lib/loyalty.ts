import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import { LEVELS, MONTHLY_TARGETS, istMonth, levelIndexForXp, xpFromPaise } from "@/lib/loyalty";

type Db = Database.Database;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function depositTotal(db: Db, userId: string, range?: { startIso: string; endIso: string }): number {
  const row = range
    ? db
        .prepare(`SELECT COALESCE(SUM(amount),0) s FROM "Transaction" WHERE userId = ? AND type = 'DEPOSIT' AND status = 'COMPLETED' AND createdAt >= ? AND createdAt < ?`)
        .get(userId, range.startIso, range.endIso)
    : db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM "Transaction" WHERE userId = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`).get(userId);
  return (row as { s: number }).s;
}

/** Pays one reward, once. Returns false if it was already paid (unique key) or nothing to pay. */
function grant(db: Db, o: { userId: string; kind: "LEVEL" | "MONTH"; key: string; amount: number; description: string; notifType: string; title: string; body: string; now: string }): boolean {
  if (o.amount <= 0) return false;
  const rewardId = createId("loy");
  const ins = db
    .prepare(`INSERT OR IGNORE INTO LoyaltyReward (id, userId, kind, rewardKey, amount, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
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
  ).run(txnId, o.userId, o.amount, w.depositBalance + w.winningBalance + w.bonusBalance, `LOY-${o.kind}-${o.userId}-${o.key}`, o.description, JSON.stringify({ loyalty: o.kind, key: o.key }), o.now);
  db.prepare("UPDATE LoyaltyReward SET transactionId = ? WHERE id = ?").run(txnId, rewardId);
  db.prepare(`INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(
    createId("notif"), o.userId, o.notifType, o.title, o.body, o.now
  );
  return true;
}

/**
 * Call inside the deposit's own transaction, right AFTER its DEPOSIT ledger row is inserted.
 * Pays a level-up rebate for every level this deposit crosses and a rebate for every monthly
 * target it crosses. Failure here must never undo a deposit, so it runs in a savepoint and is swallowed.
 */
export function awardForDeposit(db: Db, userId: string, depositPaise: number, nowIso: string): void {
  try {
    db.transaction(() => {
      const after = depositTotal(db, userId);
      const before = after - depositPaise;
      const xpBefore = xpFromPaise(before);
      const xpAfter = xpFromPaise(after);
      LEVELS.forEach((lvl, i) => {
        if (lvl.rewardPaise > 0 && lvl.minXp > xpBefore && lvl.minXp <= xpAfter) {
          grant(db, {
            userId, kind: "LEVEL", key: String(i), amount: lvl.rewardPaise, now: nowIso,
            description: `Level up reward: ${lvl.name}`, notifType: "LEVEL_UP",
            title: `Level up! You're ${lvl.name}`, body: `${rupees(lvl.rewardPaise)} rebate was added to your bonus balance.`,
          });
        }
      });

      const month = istMonth(new Date(nowIso));
      const monthAfter = depositTotal(db, userId, month);
      const monthBefore = monthAfter - depositPaise;
      for (const t of MONTHLY_TARGETS) {
        if (t.targetPaise > monthBefore && t.targetPaise <= monthAfter) {
          grant(db, {
            userId, kind: "MONTH", key: `${month.key}:${t.targetPaise}`, amount: t.rewardPaise, now: nowIso,
            description: `Monthly target reached: ${rupees(t.targetPaise)} in ${month.label}`, notifType: "MONTHLY_TARGET",
            title: "Monthly target achieved", body: `You added ${rupees(t.targetPaise)} this month. ${rupees(t.rewardPaise)} rebate was added to your bonus balance.`,
          });
        }
      }
    })();
  } catch (err) {
    console.error("[loyalty] reward failed (deposit unaffected):", err);
  }
}

/** "2026-11:200000" -> "Monthly target ₹2,000 · Nov 2026" */
function monthlyLabel(key: string): string {
  const [ym, target] = key.split(":");
  const [y, m] = ym.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return `Monthly target ${rupees(Number(target))} · ${month}`;
}

export interface LoyaltySummary {
  xp: number;
  level: { index: number; name: string };
  next: { name: string; minXp: number; xpToNext: number; rewardPaise: number } | null;
  progressPct: number;
  levels: { index: number; name: string; minXp: number; rewardPaise: number; reached: boolean; paid: boolean }[];
  month: {
    key: string; label: string; depositedPaise: number;
    milestones: { targetPaise: number; rewardPaise: number; reached: boolean; paid: boolean }[];
    next: { targetPaise: number; rewardPaise: number; remainingPaise: number } | null;
  };
  earnedPaise: number;
  recent: { kind: string; label: string; amount: number; createdAt: string }[];
}

export function loyaltySummary(db: Db, userId: string, now = new Date()): LoyaltySummary {
  const xp = xpFromPaise(depositTotal(db, userId));
  const idx = levelIndexForXp(xp);
  const nextLvl = LEVELS[idx + 1];
  const cur = LEVELS[idx];
  const progressPct = nextLvl ? Math.min(100, ((xp - cur.minXp) / (nextLvl.minXp - cur.minXp)) * 100) : 100;

  const paidRows = db.prepare("SELECT kind, rewardKey, amount, createdAt FROM LoyaltyReward WHERE userId = ? ORDER BY createdAt DESC").all(userId) as {
    kind: string; rewardKey: string; amount: number; createdAt: string;
  }[];
  const paid = new Set(paidRows.map((r) => `${r.kind}:${r.rewardKey}`));

  const month = istMonth(now);
  const monthDeposited = depositTotal(db, userId, month);
  const milestones = MONTHLY_TARGETS.map((t) => ({
    ...t, reached: monthDeposited >= t.targetPaise, paid: paid.has(`MONTH:${month.key}:${t.targetPaise}`),
  }));
  const nextT = MONTHLY_TARGETS.find((t) => monthDeposited < t.targetPaise);

  return {
    xp,
    level: { index: idx, name: cur.name },
    next: nextLvl ? { name: nextLvl.name, minXp: nextLvl.minXp, xpToNext: nextLvl.minXp - xp, rewardPaise: nextLvl.rewardPaise } : null,
    progressPct,
    levels: LEVELS.map((l, i) => ({ index: i, ...l, reached: xp >= l.minXp, paid: paid.has(`LEVEL:${i}`) })),
    month: {
      key: month.key, label: month.label, depositedPaise: monthDeposited, milestones,
      next: nextT ? { targetPaise: nextT.targetPaise, rewardPaise: nextT.rewardPaise, remainingPaise: nextT.targetPaise - monthDeposited } : null,
    },
    earnedPaise: paidRows.reduce((a, r) => a + r.amount, 0),
    recent: paidRows.slice(0, 8).map((r) => ({
      kind: r.kind,
      label: r.kind === "LEVEL" ? `Level up: ${LEVELS[Number(r.rewardKey)]?.name ?? ""}` : monthlyLabel(r.rewardKey),
      amount: r.amount,
      createdAt: r.createdAt,
    })),
  };
}
