import { db } from "@/server/db/client";
import { ApiError } from "@/server/lib/api-response";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";

export type DepositRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DepositRequestRow {
  id: string;
  code: string | null;
  userId: string;
  amount: number;
  utr: string;
  screenshotUrl: string;
  paymentMethod: string;
  status: DepositRequestStatus;
  adminNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** UTRs are 12 digits for UPI; some banks/apps issue 12-22 char alphanumeric references. */
export const UTR_REGEX = /^[A-Z0-9]{12,22}$/;

export function normalizeUtr(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** The Transaction.referenceId used for a credited manual deposit. UNIQUE in the DB, so a UTR can never be credited twice. */
export function depositReference(utr: string): string {
  return `UPI-${utr}`;
}

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toLocaleString("en-IN") : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

const USER_JOIN_SELECT = `
  SELECT dr.id, dr.code, dr.userId, dr.amount, dr.utr, dr.paymentMethod, dr.status, dr.adminNote,
         dr.reviewedById, dr.reviewedAt, dr.transactionId, dr.createdAt, dr.updatedAt,
         u.username, u.email
  FROM DepositRequest dr JOIN User u ON u.id = dr.userId
`;

export function listDepositRequests(opts: { userId?: string; status?: string; limit?: number }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.userId) {
    where.push("dr.userId = ?");
    params.push(opts.userId);
  }
  if (opts.status) {
    where.push("dr.status = ?");
    params.push(opts.status);
  }
  const sql =
    USER_JOIN_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY dr.createdAt DESC LIMIT ?";
  params.push(Math.min(opts.limit ?? 50, 200));
  return db.prepare(sql).all(...params);
}

export function getDepositRequest(id: string) {
  return db.prepare(USER_JOIN_SELECT + " WHERE dr.id = ?").get(id) as
    | (Omit<DepositRequestRow, "screenshotUrl"> & { username: string; email: string })
    | undefined;
}

function insertNotification(userId: string, type: string, title: string, body: string, data: unknown, now: string) {
  db.prepare(
    `INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(createId("notif"), userId, type, title, body, JSON.stringify(data), now);
}

/** Creates a PENDING request. The wallet is deliberately NOT touched here. */
export function createDepositRequest(input: {
  userId: string;
  amountPaise: number;
  utr: string;
  screenshotKey: string;
}): { id: string; code: string } {
  const now = new Date().toISOString();
  const id = createId("depreq");

  try {
    return db.transaction(() => {
      const res = db
        .prepare(
          `INSERT INTO DepositRequest (id, userId, amount, utr, screenshotUrl, paymentMethod, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'UPI', 'PENDING', ?, ?)`
        )
        .run(id, input.userId, input.amountPaise, input.utr, input.screenshotKey, now, now);

      const code = `XA${10000 + Number(res.lastInsertRowid)}`;
      db.prepare("UPDATE DepositRequest SET code = ? WHERE id = ?").run(code, id);

      insertNotification(
        input.userId,
        "DEPOSIT_PENDING",
        "Deposit request submitted",
        "Payment request submitted. Your deposit is pending admin verification.",
        { depositRequestId: id },
        now
      );
      return { id, code };
    })();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: DepositRequest\.utr/.test(err.message)) {
      throw new ApiError(409, "This UTR has already been submitted.", "DUPLICATE_UTR");
    }
    throw err;
  }
}

/**
 * Approves a deposit and credits the wallet — atomically.
 *
 * better-sqlite3 transactions are synchronous, and `.immediate()` opens the
 * transaction with BEGIN IMMEDIATE, taking SQLite's write lock up front. Two
 * admins clicking Approve at once are therefore fully serialised: the second
 * one sees status = APPROVED and gets ALREADY_REVIEWED. On any thrown error
 * the whole transaction rolls back (no credit, no ledger row, no status change).
 *
 * Postgres equivalent: SELECT ... FOR UPDATE on the DepositRequest and Wallet rows.
 */
export function approveDepositRequest(params: { id: string; adminId: string; ipAddress?: string | null }) {
  const run = db.transaction(() => {
    // 1. request exists
    const req = db.prepare("SELECT * FROM DepositRequest WHERE id = ?").get(params.id) as DepositRequestRow | undefined;
    if (!req) throw new ApiError(404, "Deposit request not found.", "NOT_FOUND");

    // 2. still pending
    if (req.status !== "PENDING") {
      throw new ApiError(409, `This request was already ${req.status.toLowerCase()}.`, "ALREADY_REVIEWED");
    }

    // 3. UTR not already credited (defence in depth on top of UNIQUE(utr))
    const reference = depositReference(req.utr);
    const alreadyCredited = db.prepare(`SELECT id FROM "Transaction" WHERE referenceId = ?`).get(reference);
    if (alreadyCredited) {
      throw new ApiError(409, "This UTR has already been credited.", "UTR_ALREADY_CREDITED");
    }

    // 4. wallet exists
    const wallet = db.prepare("SELECT userId FROM Wallet WHERE userId = ?").get(req.userId);
    if (!wallet) throw new ApiError(404, "User wallet not found.", "WALLET_NOT_FOUND");

    const now = new Date().toISOString();

    // 5. claim the request — the status guard makes this a compare-and-swap
    const claimed = db
      .prepare(
        `UPDATE DepositRequest SET status = 'APPROVED', reviewedById = ?, reviewedAt = ?, updatedAt = ?
         WHERE id = ? AND status = 'PENDING'`
      )
      .run(params.adminId, now, now, req.id);
    if (claimed.changes !== 1) {
      throw new ApiError(409, "This request was already reviewed.", "ALREADY_REVIEWED");
    }

    // 6. credit the wallet
    db.prepare("UPDATE Wallet SET depositBalance = depositBalance + ?, updatedAt = ? WHERE userId = ?").run(
      req.amount,
      now,
      req.userId
    );
    const w = db
      .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
      .get(req.userId) as { depositBalance: number; winningBalance: number; bonusBalance: number };
    const total = w.depositBalance + w.winningBalance + w.bonusBalance;

    // 7. ledger entry
    const txnId = createId("txn");
    db.prepare(
      `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
       VALUES (?, ?, 'DEPOSIT', 'COMPLETED', ?, ?, ?, 'Wallet Added', ?, ?)`
    ).run(
      txnId,
      req.userId,
      req.amount,
      total,
      reference,
      JSON.stringify({ depositRequestId: req.id, code: req.code, utr: req.utr, method: "UPI", approvedBy: params.adminId }),
      now
    );
    db.prepare("UPDATE DepositRequest SET transactionId = ? WHERE id = ?").run(txnId, req.id);

    // 8. user notification + audit trail (same transaction)
    insertNotification(
      req.userId,
      "DEPOSIT_SUCCESS",
      "Deposit approved",
      `${formatRupees(req.amount)} has been added to your XArena wallet.`,
      { depositRequestId: req.id },
      now
    );
    writeAuditLog({
      actorId: params.adminId,
      action: "DEPOSIT_REQUEST_APPROVED",
      targetType: "DepositRequest",
      targetId: req.id,
      metadata: { amountPaise: req.amount, utr: req.utr, userId: req.userId },
      ipAddress: params.ipAddress,
    });

    return { id: req.id, amount: req.amount, balanceAfter: total };
  });

  return run.immediate();
}

export function rejectDepositRequest(params: { id: string; adminId: string; reason?: string; ipAddress?: string | null }) {
  const run = db.transaction(() => {
    const req = db.prepare("SELECT * FROM DepositRequest WHERE id = ?").get(params.id) as DepositRequestRow | undefined;
    if (!req) throw new ApiError(404, "Deposit request not found.", "NOT_FOUND");
    if (req.status !== "PENDING") {
      throw new ApiError(409, `This request was already ${req.status.toLowerCase()}.`, "ALREADY_REVIEWED");
    }

    const now = new Date().toISOString();
    const reason = params.reason?.trim() || null;

    const changed = db
      .prepare(
        `UPDATE DepositRequest SET status = 'REJECTED', adminNote = ?, reviewedById = ?, reviewedAt = ?, updatedAt = ?
         WHERE id = ? AND status = 'PENDING'`
      )
      .run(reason, params.adminId, now, now, req.id);
    if (changed.changes !== 1) throw new ApiError(409, "This request was already reviewed.", "ALREADY_REVIEWED");

    const body = reason
      ? `Deposit rejected: ${reason}`
      : `Your ${formatRupees(req.amount)} deposit request was rejected.`;
    insertNotification(req.userId, "DEPOSIT_REJECTED", "Deposit rejected", body, { depositRequestId: req.id }, now);

    writeAuditLog({
      actorId: params.adminId,
      action: "DEPOSIT_REQUEST_REJECTED",
      targetType: "DepositRequest",
      targetId: req.id,
      metadata: { amountPaise: req.amount, utr: req.utr, reason },
      ipAddress: params.ipAddress,
    });
    return { id: req.id };
  });

  return run.immediate();
}
