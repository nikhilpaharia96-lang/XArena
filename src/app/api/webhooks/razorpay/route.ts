import { db } from "@/server/db/client";
import { createId, createReferenceId } from "@/server/lib/ids";
import { verifyWebhookSignature } from "@/server/lib/razorpay";
import { NextResponse } from "next/server";

interface DepositRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
}

/**
 * Server-to-server webhook — the authoritative source of truth for payment
 * confirmation (a client can close the browser mid-checkout after paying;
 * this fires regardless). Configure this URL in the Razorpay dashboard
 * under Settings → Webhooks, subscribed to the `payment.captured` event,
 * with a webhook secret set in RAZORPAY_WEBHOOK_SECRET.
 *
 * TODO(RAZORPAY_WEBHOOK_SECRET): must be set for this route to accept
 * anything — until then it correctly rejects all payloads rather than
 * trusting unsigned input.
 *
 * Idempotency: guarded by checking Deposit.status before crediting, so a
 * redelivered webhook (Razorpay retries on non-2xx) or a race with the
 * client-side /verify route never double-credits the wallet.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let validSignature: boolean;
  try {
    validSignature = verifyWebhookSignature(rawBody, signature);
  } catch {
    // RAZORPAY_WEBHOOK_SECRET not configured yet.
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event === "payment.captured") {
    const payment = payload.payload.payment.entity;
    const orderId = payment.order_id as string;
    const paymentId = payment.id as string;

    const deposit = db
      .prepare("SELECT id, userId, amount, status FROM Deposit WHERE razorpayOrderId = ?")
      .get(orderId) as DepositRow | undefined;

    if (deposit && deposit.status !== "COMPLETED") {
      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(
          `UPDATE Deposit SET status = 'COMPLETED', razorpayPaymentId = ?, verifiedAt = ? WHERE id = ?`
        ).run(paymentId, now, deposit.id);

        db.prepare(`UPDATE Wallet SET depositBalance = depositBalance + ?, updatedAt = ? WHERE userId = ?`).run(
          deposit.amount,
          now,
          deposit.userId
        );

        const wallet = db
          .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
          .get(deposit.userId) as { depositBalance: number; winningBalance: number; bonusBalance: number };
        const total = wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance;

        db.prepare(
          `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
           VALUES (?, ?, 'DEPOSIT', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
        ).run(
          createId("txn"),
          deposit.userId,
          deposit.amount,
          total,
          createReferenceId("DEP"),
          "Wallet deposit via Razorpay (webhook)",
          JSON.stringify({ razorpayPaymentId: paymentId }),
          now
        );

        db.prepare(
          `INSERT INTO Notification (id, userId, type, title, body, createdAt)
           VALUES (?, ?, 'DEPOSIT_SUCCESS', ?, ?, ?)`
        ).run(createId("notif"), deposit.userId, "Deposit successful", `₹${deposit.amount / 100} has been added to your wallet.`, now);
      })();
    }
  }

  // Always 200 on successfully-verified, successfully-processed webhooks so
  // Razorpay stops retrying. Unhandled event types are acknowledged too —
  // we only act on the ones we care about.
  return NextResponse.json({ received: true });
}
