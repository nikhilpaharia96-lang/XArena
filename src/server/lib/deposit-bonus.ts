import type Database from "better-sqlite3";
import { ApiError } from "./api-response";
import { createId } from "./ids";
import { wageredInRange } from "./vip";

type Db = Database.Database;

export interface BonusOffer {
  id: string; sortOrder: number; title: string; bonusPercent: number; rollingX: number;
  maxBonus: number; minDeposit: number; validDays: number; active: number;
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function listOffers(db: Db, opts: { activeOnly?: boolean } = {}): BonusOffer[] {
  return db
    .prepare(`SELECT * FROM DepositBonusOffer ${opts.activeOnly ? "WHERE active = 1" : ""} ORDER BY sortOrder, createdAt`)
    .all() as BonusOffer[];
}

/** Bonus for a deposit under an offer: percent of the deposit, capped. 0 when under the offer's minimum. */
export function computeBonus(offer: Pick<BonusOffer, "bonusPercent" | "maxBonus" | "minDeposit">, depositPaise: number): number {
  if (depositPaise < offer.minDeposit) return 0;
  return Math.min(Math.floor((depositPaise * offer.bonusPercent) / 100), offer.maxBonus);
}

/** Checked when the player submits a deposit request with an offer selected. */
export function assertOfferUsable(db: Db, offerId: string, depositPaise: number): BonusOffer {
  const offer = db.prepare("SELECT * FROM DepositBonusOffer WHERE id = ?").get(offerId) as BonusOffer | undefined;
  if (!offer || !offer.active) throw new ApiError(400, "This bonus offer is no longer available.", "OFFER_UNAVAILABLE");
  if (depositPaise < offer.minDeposit) {
    throw new ApiError(400, `This bonus needs a deposit of at least ${rupees(offer.minDeposit)}.`, "OFFER_MIN_DEPOSIT");
  }
  return offer;
}

function notify(db: Db, userId: string, type: string, title: string, body: string, now: string) {
  db.prepare("INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(createId("notif"), userId, type, title, body, JSON.stringify({}), now);
}

function totalOf(db: Db, userId: string): number {
  const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(userId) as
    { depositBalance: number; winningBalance: number; bonusBalance: number };
  return w.depositBalance + w.winningBalance + w.bonusBalance;
}

function ledger(db: Db, userId: string, type: string, amount: number, ref: string, description: string, now: string) {
  db.prepare(
    `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
     VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?, ?, '{}', ?)`
  ).run(createId("txn"), userId, type, amount, totalOf(db, userId), ref, description, now);
}

/**
 * Called inside the deposit-approval transaction. If the request carried an offer, credits the bonus to the
 * bonus wallet and starts its rolling requirement. A 0x (instant) offer is unlocked straight away.
 * Idempotent: the grant is UNIQUE per deposit request.
 */
export function grantDepositBonus(db: Db, depositRequestId: string, now: string): { bonus: number } | null {
  const req = db.prepare("SELECT userId, amount, offerId FROM DepositRequest WHERE id = ?").get(depositRequestId) as
    { userId: string; amount: number; offerId: string | null } | undefined;
  if (!req?.offerId) return null;
  const offer = db.prepare("SELECT * FROM DepositBonusOffer WHERE id = ?").get(req.offerId) as BonusOffer | undefined;
  if (!offer) return null; // offer deleted meanwhile: the deposit itself still goes through
  const bonus = computeBonus(offer, req.amount);
  if (bonus <= 0) return null;

  const grantId = createId("bgrant");
  const expiresAt = offer.validDays > 0 ? new Date(new Date(now).getTime() + offer.validDays * 86_400_000).toISOString() : null;
  const res = db.prepare(
    `INSERT OR IGNORE INTO BonusGrant (id, userId, depositRequestId, offerId, title, depositAmount, bonusAmount, rollingX, requiredWager, startedAt, expiresAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(grantId, req.userId, depositRequestId, offer.id, offer.title, req.amount, bonus, offer.rollingX, bonus * offer.rollingX, now, expiresAt);
  if (res.changes === 0) return null;

  db.prepare("UPDATE Wallet SET bonusBalance = bonusBalance + ?, updatedAt = ? WHERE userId = ?").run(bonus, now, req.userId);
  ledger(db, req.userId, "DEPOSIT_BONUS", bonus, `DBONUS-${depositRequestId}`, `${offer.title} (${offer.bonusPercent}%)`, now);
  const rule = offer.rollingX === 0
    ? "No rolling needed — it's yours to withdraw."
    : `Play ${rupees(bonus * offer.rollingX)} (${offer.rollingX}x) within ${offer.validDays} days to unlock it for withdrawal.`;
  notify(db, req.userId, "BONUS_CREDITED", `${rupees(bonus)} bonus added`, rule, now);
  settleOne(db, { id: grantId }, now);
  return { bonus };
}

interface GrantRow {
  id: string; userId: string; bonusAmount: number; requiredWager: number; startedAt: string; expiresAt: string | null; status: string; title: string;
}

function settleOne(db: Db, ref: { id: string }, now: string) {
  const g = db.prepare("SELECT * FROM BonusGrant WHERE id = ? AND status = 'ACTIVE'").get(ref.id) as GrantRow | undefined;
  if (!g) return;
  const wagered = wageredInRange(db, g.userId, g.startedAt, new Date(new Date(now).getTime() + 1000).toISOString());
  const left = () => (db.prepare("SELECT bonusBalance FROM Wallet WHERE userId = ?").get(g.userId) as { bonusBalance: number }).bonusBalance;

  if (wagered >= g.requiredWager) {
    const amt = Math.min(g.bonusAmount, left());
    db.prepare("UPDATE BonusGrant SET status = 'COMPLETED', settledAt = ? WHERE id = ?").run(now, g.id);
    if (amt > 0) {
      db.prepare("UPDATE Wallet SET bonusBalance = bonusBalance - ?, winningBalance = winningBalance + ?, updatedAt = ? WHERE userId = ?").run(amt, amt, now, g.userId);
      ledger(db, g.userId, "BONUS_UNLOCK", amt, `BUNLOCK-${g.id}`, `${g.title} unlocked — now withdrawable`, now);
      if (g.requiredWager > 0) notify(db, g.userId, "BONUS_UNLOCKED", `${rupees(amt)} bonus unlocked`, "Rolling complete. The amount moved to your winnings and can be withdrawn.", now);
    }
  } else if (g.expiresAt && g.expiresAt <= now) {
    const amt = Math.min(g.bonusAmount, left());
    db.prepare("UPDATE BonusGrant SET status = 'EXPIRED', settledAt = ? WHERE id = ?").run(now, g.id);
    if (amt > 0) {
      db.prepare("UPDATE Wallet SET bonusBalance = bonusBalance - ?, updatedAt = ? WHERE userId = ?").run(amt, now, g.userId);
      ledger(db, g.userId, "BONUS_EXPIRED", amt, `BEXPIRE-${g.id}`, `${g.title} expired (rolling not completed)`, now);
      notify(db, g.userId, "BONUS_EXPIRED", "Bonus expired", `The unplayed ${rupees(amt)} of your ${g.title} expired. Your deposit is untouched.`, now);
    }
  }
}

/** Unlocks finished bonuses and expires overdue ones for this user. Cheap and safe to call often. */
export function settleBonusGrants(db: Db, userId: string, now = new Date().toISOString()) {
  const ids = db.prepare("SELECT id FROM BonusGrant WHERE userId = ? AND status = 'ACTIVE'").all(userId) as { id: string }[];
  if (ids.length === 0) return;
  db.transaction(() => { for (const g of ids) settleOne(db, g, now); }).immediate();
}

export function listGrants(db: Db, userId: string, now = new Date().toISOString()) {
  settleBonusGrants(db, userId, now);
  const rows = db.prepare("SELECT * FROM BonusGrant WHERE userId = ? ORDER BY startedAt DESC LIMIT 20").all(userId) as (GrantRow & { depositAmount: number; rollingX: number })[];
  return rows.map((g) => {
    const wagered = g.status === "ACTIVE"
      ? wageredInRange(db, userId, g.startedAt, new Date(new Date(now).getTime() + 1000).toISOString())
      : g.requiredWager;
    return { ...g, wagered: Math.min(wagered, g.requiredWager) };
  });
}

export interface OfferInput {
  title: string; bonusPercent: number; rollingX: number; maxBonusRupees: number; minDepositRupees: number;
  validDays: number; active: boolean; sortOrder: number;
}

function checkOffer(i: OfferInput) {
  const int = (n: unknown) => typeof n === "number" && Number.isInteger(n);
  if (typeof i.title !== "string" || i.title.trim().length < 2 || i.title.trim().length > 40) throw new ApiError(400, "Title must be 2–40 characters.", "VALIDATION_ERROR");
  if (!int(i.bonusPercent) || i.bonusPercent < 1 || i.bonusPercent > 100) throw new ApiError(400, "Bonus % must be 1–100.", "VALIDATION_ERROR");
  if (!int(i.rollingX) || i.rollingX < 0 || i.rollingX > 100) throw new ApiError(400, "Rolling must be 0–100x.", "VALIDATION_ERROR");
  if (!int(i.maxBonusRupees) || i.maxBonusRupees < 1 || i.maxBonusRupees > 1_000_000) throw new ApiError(400, "Max bonus must be ₹1–₹10,00,000.", "VALIDATION_ERROR");
  if (!int(i.minDepositRupees) || i.minDepositRupees < 0 || i.minDepositRupees > 1_000_000) throw new ApiError(400, "Invalid minimum deposit.", "VALIDATION_ERROR");
  if (!int(i.validDays) || i.validDays < 0 || i.validDays > 365) throw new ApiError(400, "Validity must be 0–365 days.", "VALIDATION_ERROR");
  if (i.rollingX > 0 && i.validDays === 0) throw new ApiError(400, "An offer with rolling needs a validity in days.", "VALIDATION_ERROR");
  if (!int(i.sortOrder) || i.sortOrder < 0 || i.sortOrder > 1000) throw new ApiError(400, "Invalid order.", "VALIDATION_ERROR");
}

/** Admin: create (no id) or update an offer. Existing grants keep the terms they were given. */
export function saveOffer(db: Db, input: OfferInput, id?: string): string {
  checkOffer(input);
  const vals = [input.title.trim(), input.bonusPercent, input.rollingX, input.maxBonusRupees * 100, input.minDepositRupees * 100, input.validDays, input.active ? 1 : 0, input.sortOrder] as const;
  if (id) {
    const r = db.prepare("UPDATE DepositBonusOffer SET title=?, bonusPercent=?, rollingX=?, maxBonus=?, minDeposit=?, validDays=?, active=?, sortOrder=? WHERE id = ?").run(...vals, id);
    if (r.changes === 0) throw new ApiError(404, "Offer not found.", "NOT_FOUND");
    return id;
  }
  const newId = createId("dbo");
  db.prepare("INSERT INTO DepositBonusOffer (title, bonusPercent, rollingX, maxBonus, minDeposit, validDays, active, sortOrder, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(...vals, newId);
  return newId;
}

export function deleteOffer(db: Db, id: string) {
  // Pending requests that picked it simply get no bonus (grantDepositBonus skips a missing offer).
  if (db.prepare("DELETE FROM DepositBonusOffer WHERE id = ?").run(id).changes === 0) throw new ApiError(404, "Offer not found.", "NOT_FOUND");
}
