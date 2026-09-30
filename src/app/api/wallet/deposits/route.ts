import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { getPaymentSettings, isPaymentConfigured } from "@/server/lib/payment-settings";
import { deleteUpload, saveImageUpload } from "@/server/lib/uploads";
import { rupeesToPaise } from "@/server/lib/money";
import { createDepositRequest, listDepositRequests, normalizeUtr, UTR_REGEX } from "@/server/lib/deposit-requests";

const MAX_PENDING_PER_USER = 3;

/**
 * POST /api/wallet/deposits  (multipart/form-data: amountRupees, utr, screenshot)
 *
 * Creates a PENDING manual UPI deposit request. The wallet is NOT credited
 * here — only an admin approval (see /api/admin/deposit-requests/[id]/approve)
 * can do that. Everything is validated server-side: userId comes from the
 * session, amount limits from the DB settings, never from the client.
 */
export async function POST(req: Request) {
  let screenshotKey: string | null = null;
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`deposit-req:${getClientKey(req)}:${user.id}`, 10, 60_000);
    if (!allowed) throw new ApiError(429, "Too many requests. Please slow down.", "RATE_LIMITED");

    const settings = getPaymentSettings();
    if (!settings.depositEnabled) {
      throw new ApiError(503, "Deposits are temporarily unavailable.", "DEPOSITS_DISABLED");
    }
    if (!isPaymentConfigured(settings)) {
      throw new ApiError(503, "Deposits aren't set up yet. Please try again later.", "PAYMENTS_NOT_CONFIGURED");
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError(400, "Invalid form submission.", "VALIDATION_ERROR");
    }

    // --- amount ---
    const amountRaw = String(form.get("amountRupees") ?? "").trim();
    if (!/^\d{1,7}$/.test(amountRaw)) {
      throw new ApiError(400, "Enter a valid whole-rupee amount.", "VALIDATION_ERROR");
    }
    const amountRupees = Number(amountRaw);
    if (amountRupees < settings.minDepositRupees) {
      throw new ApiError(400, `Minimum deposit is ₹${settings.minDepositRupees}.`, "BELOW_MINIMUM");
    }
    if (amountRupees > settings.maxDepositRupees) {
      throw new ApiError(400, `Maximum deposit is ₹${settings.maxDepositRupees.toLocaleString("en-IN")}.`, "ABOVE_MAXIMUM");
    }

    // --- UTR ---
    const utr = normalizeUtr(String(form.get("utr") ?? ""));
    if (!utr) throw new ApiError(400, "UTR / Transaction ID is required.", "VALIDATION_ERROR");
    if (!UTR_REGEX.test(utr)) {
      throw new ApiError(400, "UTR must be 12–22 letters/numbers (usually 12 digits).", "INVALID_UTR");
    }

    // --- screenshot ---
    const file = form.get("screenshot");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Payment screenshot is required.", "FILE_REQUIRED");
    }

    // --- duplicate / abuse guards (before we write any file) ---
    const dup = db.prepare("SELECT id FROM DepositRequest WHERE utr = ?").get(utr);
    if (dup) throw new ApiError(409, "This UTR has already been submitted.", "DUPLICATE_UTR");

    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM DepositRequest WHERE userId = ? AND status = 'PENDING'")
      .get(user.id) as { count: number };
    if (count >= MAX_PENDING_PER_USER) {
      throw new ApiError(
        429,
        `You already have ${MAX_PENDING_PER_USER} deposits awaiting verification. Please wait for them to be reviewed.`,
        "TOO_MANY_PENDING"
      );
    }

    screenshotKey = await saveImageUpload(file, "deposits");
    const created = createDepositRequest({
      userId: user.id,
      amountPaise: rupeesToPaise(amountRupees),
      utr,
      screenshotKey,
    });

    return ok({ id: created.id, code: created.code, status: "PENDING" }, 201);
  } catch (error) {
    // Don't leave an orphaned upload behind if the request didn't get created.
    if (screenshotKey) deleteUpload(screenshotKey);
    return fail(error);
  }
}

/** GET /api/wallet/deposits — the signed-in user's own requests only. */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const rows = listDepositRequests({ userId: user.id, status, limit: 50 });
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
