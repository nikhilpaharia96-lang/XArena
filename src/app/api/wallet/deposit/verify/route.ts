import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { verifyPaymentSignature } from "@/server/lib/razorpay";
import { z } from "zod";

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

interface DepositRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
}

/**
 * Confirms a deposit immediately after Razorpay Checkout succeeds
 * client-side. This gives the user instant wallet credit UX. It is
 * intentionally re-verified: the webhook handler (/api/webhooks/razorpay)
 * is idempotent and will no-op if this route already marked the deposit
 * COMPLETED, and vice versa — whichever fires first wins, the other is a
 * safe no-op. Never trust amount/order id from the client body beyond
 * looking up our own PENDING Deposit row by order id.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const input = verifySchema.parse(body);

    const isValid = verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
    if (!isValid) {
      throw new ApiError(400, "Payment verification failed.", "INVALID_SIGNATURE");
    }

    const deposit = db
      .prepare("SELECT id, userId, amount, status FROM Deposit WHERE razorpayOrderId = ?")
      .get(input.razorpayOrderId) as DepositRow | undefined;

    if (!deposit) {
      throw new ApiError(404, "Deposit record not found.", "NOT_FOUND");
    }
    if (deposit.userId !== user.id) {
      throw new ApiError(403, "This deposit doesn't belong to you.", "FORBIDDEN");
    }
    if (deposit.status === "COMPLETED") {
      // Idempotent: webhook likely already processed it. Not an error.
      return ok({ credited: true, alreadyProcessed: true });
    }

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(
        `UPDATE Deposit SET status = 'COMPLETED', razorpayPaymentId = ?, razorpaySignature = ?, verifiedAt = ? WHERE id = ?`
      ).run(input.razorpayPaymentId, input.razorpaySignature, now, deposit.id);

      db.prepare(`UPDATE Wallet SET depositBalance = depositBalance + ?, updatedAt = ? WHERE userId = ?`).run(
        deposit.amount,
        now,
        user.id
      );

      const wallet = db
        .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
        .get(user.id) as { depositBalance: number; winningBalance: number; bonusBalance: number };
      const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;

      db.prepare(
        `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
         VALUES (?, ?, 'DEPOSIT', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
      ).run(
        createId("txn"),
        user.id,
        deposit.amount,
        total,
        createReferenceId("DEP"),
        "Wallet deposit via Razorpay",
        JSON.stringify({ razorpayPaymentId: input.razorpayPaymentId }),
        now
      );

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, createdAt)
         VALUES (?, ?, 'DEPOSIT_SUCCESS', ?, ?, ?)`
      ).run(createId("notif"), user.id, "Deposit successful", `₹${deposit.amount / 100} has been added to your wallet.`, now);
    })();

    return ok({ credited: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    if (error instanceof Error && error.message === "RAZORPAY_NOT_CONFIGURED") {
      return fail(new ApiError(503, "Payments aren't configured yet.", "PAYMENTS_NOT_CONFIGURED"));
    }
    return fail(error);
  }
}
