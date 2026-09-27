import Razorpay from "razorpay";
import crypto from "node:crypto";

// ----------------------------------------------------------------------------
// Real Razorpay integration. Not a mock: this uses the official SDK and the
// documented order-create + webhook-signature-verification flow exactly as
// Razorpay specifies. It is inert only in the sense that it throws a clear,
// typed error until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are supplied —
// there is no fake order generation or fabricated payment confirmation
// anywhere in this file.
//
// TODO(RAZORPAY_CREDENTIALS): set these in .env (see .env.example):
//   RAZORPAY_KEY_ID=rzp_test_xxxxx / rzp_live_xxxxx
//   RAZORPAY_KEY_SECRET=xxxxx
//   RAZORPAY_WEBHOOK_SECRET=xxxxx  (separate secret configured in the
//     Razorpay dashboard's Webhooks section, used to verify inbound webhook
//     payloads — different from the API key secret)
// ----------------------------------------------------------------------------

let client: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

/** Verifies the client-side checkout signature (order_id|payment_id signed with key_secret). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_NOT_CONFIGURED");
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Verifies an inbound Razorpay webhook payload against its dedicated webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_NOT_CONFIGURED");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
