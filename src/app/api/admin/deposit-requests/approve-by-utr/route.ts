import { z } from "zod";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { approveDepositByUtr } from "@/server/lib/deposit-requests";
import { rupeesToPaise } from "@/server/lib/money";

const bodySchema = z.object({
  utr: z.string().trim().min(1, "UTR is required").max(40),
  amount: z.coerce.number().positive("Enter a valid amount").max(1_000_000),
});

/**
 * Admin types UTR + amount (rupees). If a PENDING request has that UTR and exactly that
 * amount it is approved and the wallet credited automatically. Otherwise nothing changes.
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid input.", "VALIDATION_ERROR");
    }

    const result = approveDepositByUtr({
      utr: parsed.data.utr,
      amountPaise: rupeesToPaise(parsed.data.amount),
      adminId: admin.id,
      ipAddress: getClientKey(req),
    });
    return ok({ approved: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
