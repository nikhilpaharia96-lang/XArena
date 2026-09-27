import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";

const rejectSchema = z.object({ reason: z.string().trim().min(5).max(300) });

interface WithdrawRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const body = await req.json();
    const input = rejectSchema.parse(body);

    const withdrawal = db.prepare("SELECT id, userId, amount, status FROM WithdrawRequest WHERE id = ?").get(id) as
      | WithdrawRow
      | undefined;
    if (!withdrawal) throw new ApiError(404, "Withdrawal request not found.", "NOT_FOUND");
    if (withdrawal.status !== "PENDING") {
      throw new ApiError(400, "This request has already been reviewed.", "ALREADY_REVIEWED");
    }

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `UPDATE WithdrawRequest SET status = 'REJECTED', reviewedById = ?, reviewedAt = ?, rejectionReason = ? WHERE id = ?`
      ).run(admin.id, now, input.reason, id);

      // Return the locked amount back to spendable winning balance.
      db.prepare(
        "UPDATE Wallet SET lockedBalance = lockedBalance - ?, winningBalance = winningBalance + ?, updatedAt = ? WHERE userId = ?"
      ).run(withdrawal.amount, withdrawal.amount, now, withdrawal.userId);

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'WITHDRAW_REJECTED', ?, ?, ?)`
      ).run(
        createId("notif"),
        withdrawal.userId,
        "Withdrawal rejected",
        `Your withdrawal request was rejected: ${input.reason}. The amount has been returned to your winning balance.`,
        now
      );
    })();

    writeAuditLog({
      actorId: admin.id,
      action: "WITHDRAWAL_REJECTED",
      targetType: "WithdrawRequest",
      targetId: id,
      metadata: { reason: input.reason },
    });

    return ok({ rejected: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
