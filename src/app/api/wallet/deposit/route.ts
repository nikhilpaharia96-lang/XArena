import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { getRazorpayClient, isRazorpayConfigured } from "@/server/lib/razorpay";
import { depositSchema } from "@/types/schemas";
import { rupeesToPaise } from "@/server/lib/money";

/**
 * Creates a Razorpay order for the requested amount and records a Deposit
 * row in PENDING status keyed by the order id. The wallet is NOT credited
 * here — that only happens once payment is confirmed, via either the
 * client-side verify call (see /api/wallet/deposit/verify) or, preferably
 * in production, the server-to-server webhook (/api/webhooks/razorpay),
 * which is authoritative because it can't be spoofed by a client that
 * closes the checkout modal after a successful charge.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`deposit:${getClientKey(req)}:${user.id}`, 10, 60_000);
    if (!allowed) {
      throw new ApiError(429, "Too many requests. Please slow down.");
    }

    if (!isRazorpayConfigured()) {
      throw new ApiError(
        503,
        "Payments aren't configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable deposits.",
        "PAYMENTS_NOT_CONFIGURED"
      );
    }

    const body = await req.json();
    const input = depositSchema.parse(body);
    const amountPaise = rupeesToPaise(input.amountRupees);

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: createId("dep"),
      notes: { userId: user.id },
    });

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO Deposit (id, userId, amount, status, razorpayOrderId, createdAt)
       VALUES (?, ?, ?, 'PENDING', ?, ?)`
    ).run(createId("depr"), user.id, amountPaise, order.id, now);

    return ok({
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
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
