import { db } from "@/server/db/client";
import { ApiError } from "@/server/lib/api-response";
import { writeAuditLog } from "@/server/lib/audit";
import { approveDepositRequest, normalizeUtr, UTR_REGEX } from "@/server/lib/deposit-requests";

export type QuickApproveOutcome =
  | "APPROVED"
  | "NOT_FOUND"
  | "ALREADY_APPROVED"
  | "ALREADY_REJECTED"
  | "AMOUNT_MISMATCH"
  | "INVALID_UTR";

export interface QuickApproveResult {
  utr: string;
  outcome: QuickApproveOutcome;
  requestId?: string;
  code?: string | null;
  username?: string;
  /** Amount of the stored request, in paise (what the player asked for). */
  requestAmount?: number;
  /** Amount the admin typed, in paise. */
  enteredAmount?: number;
  balanceAfter?: number;
}

interface Row {
  id: string;
  code: string | null;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  username: string;
}

/**
 * The admin read a payment off the bank statement (UTR + amount received).
 * If, and only if, a PENDING deposit request has EXACTLY that UTR and EXACTLY that amount,
 * it is approved through the normal approveDepositRequest() (one atomic transaction:
 * status compare-and-swap, wallet credit, ledger row, notification, audit).
 *
 * No fuzzy or partial matching, ever. A rejected request is never re-opened here.
 */
export function quickApproveByUtr(input: { utr: string; amountPaise: number; adminId: string; ipAddress?: string | null }): QuickApproveResult {
  const utr = normalizeUtr(input.utr);
  if (!UTR_REGEX.test(utr)) return { utr, outcome: "INVALID_UTR" };

  const row = db
    .prepare("SELECT dr.id, dr.code, dr.amount, dr.status, u.username FROM DepositRequest dr JOIN User u ON u.id = dr.userId WHERE dr.utr = ?")
    .get(utr) as Row | undefined;
  if (!row) return { utr, outcome: "NOT_FOUND" };

  const base = { utr, requestId: row.id, code: row.code, username: row.username, requestAmount: row.amount, enteredAmount: input.amountPaise };
  if (row.status === "APPROVED") return { ...base, outcome: "ALREADY_APPROVED" };
  if (row.status === "REJECTED") return { ...base, outcome: "ALREADY_REJECTED" };

  if (input.amountPaise !== row.amount) {
    writeAuditLog({
      actorId: input.adminId,
      action: "DEPOSIT_QUICK_APPROVE_MISMATCH",
      targetType: "DepositRequest",
      targetId: row.id,
      metadata: { utr, requestAmountPaise: row.amount, enteredAmountPaise: input.amountPaise },
      ipAddress: input.ipAddress,
    });
    return { ...base, outcome: "AMOUNT_MISMATCH" };
  }

  try {
    // expectedAmountPaise is re-checked INSIDE the approve transaction, so nothing can change between our read and the credit.
    const r = approveDepositRequest({ id: row.id, adminId: input.adminId, ipAddress: input.ipAddress, expectedAmountPaise: input.amountPaise });
    writeAuditLog({
      actorId: input.adminId,
      action: "DEPOSIT_QUICK_APPROVED",
      targetType: "DepositRequest",
      targetId: row.id,
      metadata: { utr, amountPaise: row.amount },
      ipAddress: input.ipAddress,
    });
    return { ...base, outcome: "APPROVED", balanceAfter: r.balanceAfter };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === "ALREADY_REVIEWED") {
        const now = db.prepare("SELECT status FROM DepositRequest WHERE id = ?").get(row.id) as { status: string } | undefined;
        return { ...base, outcome: now?.status === "REJECTED" ? "ALREADY_REJECTED" : "ALREADY_APPROVED" };
      }
      if (e.code === "UTR_ALREADY_CREDITED") return { ...base, outcome: "ALREADY_APPROVED" };
      if (e.code === "AMOUNT_MISMATCH") return { ...base, outcome: "AMOUNT_MISMATCH" };
    }
    throw e;
  }
}
