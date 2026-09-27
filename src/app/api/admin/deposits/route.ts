import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

/**
 * Deposits in this platform are Razorpay-gateway-verified and
 * auto-credited via webhook/verify (see /api/wallet/deposit/*) — there is
 * no manual-approval step for the standard flow, since a signed Razorpay
 * payment confirmation is stronger evidence than a human eyeballing a
 * screenshot. This endpoint exists for finance/support visibility
 * (reconciliation, refund investigations) rather than as an approval queue.
 */
export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    let query = `
      SELECT d.id, d.amount, d.status, d.razorpayOrderId, d.razorpayPaymentId, d.createdAt, d.verifiedAt,
             u.id as userId, u.username, u.email
      FROM Deposit d JOIN User u ON u.id = d.userId
    `;
    const params: (string | number)[] = [];
    if (status) {
      query += " WHERE d.status = ?";
      params.push(status);
    }
    query += " ORDER BY d.createdAt DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
