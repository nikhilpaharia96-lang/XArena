import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { writeAuditLog } from "@/server/lib/audit";
import { getPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/server/lib/payment-settings";
import { deleteUpload, saveImageUpload } from "@/server/lib/uploads";

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

function publicShape(s: PaymentSettings) {
  return {
    upiId: s.upiId,
    accountName: s.accountName,
    instructions: s.instructions,
    minDepositRupees: s.minDepositRupees,
    maxDepositRupees: s.maxDepositRupees,
    depositEnabled: s.depositEnabled,
    hasQr: Boolean(s.qrKey),
  };
}

export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    return ok(publicShape(getPaymentSettings()));
  } catch (error) {
    return fail(error);
  }
}

/** PUT multipart/form-data — text fields plus an optional `qr` image file. */
export async function PUT(req: Request) {
  let newQrKey: string | null = null;
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "Invalid form submission.", "VALIDATION_ERROR");
    }

    const current = getPaymentSettings();
    const upiId = String(form.get("upiId") ?? "").trim();
    const accountName = String(form.get("accountName") ?? "").trim().slice(0, 80);
    const instructions = String(form.get("instructions") ?? "").trim().slice(0, 1500);
    const min = Number(form.get("minDepositRupees"));
    const max = Number(form.get("maxDepositRupees"));
    const enabled = String(form.get("depositEnabled")) === "true";

    if (upiId && !UPI_REGEX.test(upiId)) throw new ApiError(400, "Enter a valid UPI ID (e.g. name@bank).", "INVALID_UPI");
    if (!Number.isInteger(min) || min < 1) throw new ApiError(400, "Minimum deposit must be a whole number ≥ 1.", "VALIDATION_ERROR");
    if (!Number.isInteger(max) || max < min) {
      throw new ApiError(400, "Maximum deposit must be a whole number ≥ the minimum.", "VALIDATION_ERROR");
    }

    const qr = form.get("qr");
    const removeQr = String(form.get("removeQr")) === "true";
    if (qr instanceof File && qr.size > 0) newQrKey = await saveImageUpload(qr, "payment", 2 * 1024 * 1024);

    const qrKey = newQrKey ?? (removeQr ? null : current.qrKey);
    if (enabled && !upiId && !qrKey) {
      throw new ApiError(400, "Add a UPI ID or QR code before enabling deposits.", "PAYMENTS_NOT_CONFIGURED");
    }

    savePaymentSettings({
      upiId,
      accountName,
      instructions: instructions || getPaymentSettings().instructions,
      minDepositRupees: min,
      maxDepositRupees: max,
      depositEnabled: enabled,
      qrKey,
    });
    newQrKey = null; // committed — must not be cleaned up by the catch block below
    if (current.qrKey && current.qrKey !== qrKey) deleteUpload(current.qrKey);

    writeAuditLog({
      actorId: admin.id,
      action: "PAYMENT_SETTINGS_UPDATED",
      targetType: "Setting",
      targetId: "payment",
      metadata: {
        upiChanged: upiId !== current.upiId,
        qrChanged: qrKey !== current.qrKey,
        min,
        max,
        enabled,
      },
      ipAddress: getClientKey(req),
    });

    return ok(publicShape(getPaymentSettings()));
  } catch (error) {
    if (newQrKey) deleteUpload(newQrKey);
    return fail(error);
  }
}
