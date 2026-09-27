import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";

interface WithdrawRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
}

/**
 * Marks a withdrawal approved. The actual bank/UPI payout transfer is a
 * manual step today (Razorpay Payouts / RazorpayX requires a separate
 * product activation + credentials beyond basic payment-gateway keys — see
 * TODO below). This endpoint's job is the money-safe bookkeeping: it
 * releases the amount from lockedBalance permanently (it was already
 * deducted from winningBalance at request time) and records the approval.
 *
 * TODO(RAZORPAYX_PAYOUTS): once RazorpayX account + API credentials are
 * available, call the Payouts API here to actually transfer funds to
 * upiId/bankAccount, and only mark status PAID on a successful payout
 * response (keep PROCESSING in between). Until then, approval means
 * "cleared for manual bank transfer by finance team."
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const withdrawal = db.prepare("SELECT id, userId, amount, status FROM WithdrawRequest WHERE id = ?").get(id) as
      | WithdrawRow
      | undefined;
    if (!withdrawal) throw new ApiError(404, "Withdrawal request not found.", "NOT_FOUND");
    if (withdrawal.status !== "PENDING") {
      throw new ApiError(400, "This request has already been reviewed.", "ALREADY_REVIEWED");
    }

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare("UPDATE WithdrawRequest SET status = 'APPROVED', reviewedById = ?, reviewedAt = ? WHERE id = ?").run(
        admin.id,
        now,
        id
      );

      db.prepare("UPDATE Wallet SET lockedBalance = lockedBalance - ?, updatedAt = ? WHERE userId = ?").run(
        withdrawal.amount,
        now,
        withdrawal.userId
      );

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'WITHDRAW_SUCCESS', ?, ?, ?)`
      ).run(
        createId("notif"),
        withdrawal.userId,
        "Withdrawal approved",
        `Your withdrawal of ₹${withdrawal.amount / 100} has been approved and will be processed shortly.`,
        now
      );
    })();

    writeAuditLog({ actorId: admin.id, action: "WITHDRAWAL_APPROVED", targetType: "WithdrawRequest", targetId: id });

    return ok({ approved: true });
  } catch (error) {
    return fail(error);
  }
}
