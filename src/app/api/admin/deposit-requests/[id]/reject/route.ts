import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { rejectDepositRequest } from "@/server/lib/deposit-requests";
import { z } from "zod";

const rejectSchema = z.object({ reason: z.string().trim().max(300).optional() });

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const body = await req.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid input.", "VALIDATION_ERROR");

    rejectDepositRequest({ id, adminId: admin.id, reason: parsed.data.reason, ipAddress: getClientKey(req) });
    return ok({ rejected: true });
  } catch (error) {
    return fail(error);
  }
}
