import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { getPaymentSettings, isPaymentConfigured } from "@/server/lib/payment-settings";

/**
 * What the Add Money screen needs to render — and nothing more. Any
 * logged-in user can read this (they need the UPI ID/QR to pay), so it
 * exposes only public payment-destination fields, never internal keys.
 */
export async function GET() {
  try {
    await getCurrentUser();
    const s = getPaymentSettings();
    return ok({
      upiId: s.upiId,
      accountName: s.accountName,
      instructions: s.instructions,
      minDepositRupees: s.minDepositRupees,
      maxDepositRupees: s.maxDepositRupees,
      depositEnabled: s.depositEnabled,
      configured: isPaymentConfigured(s),
      hasQr: Boolean(s.qrKey),
    });
  } catch (error) {
    return fail(error);
  }
}
