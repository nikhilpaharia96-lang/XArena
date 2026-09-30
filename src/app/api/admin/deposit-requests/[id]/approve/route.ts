import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { approveDepositRequest } from "@/server/lib/deposit-requests";

/**
 * Approves a manual deposit and credits the user's wallet. All checks and
 * writes happen inside one SQLite transaction — see approveDepositRequest.
 * Nothing in the request body is trusted: the amount and user come from the
 * stored DepositRequest row.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const result = approveDepositRequest({ id, adminId: admin.id, ipAddress: getClientKey(req) });
    return ok({ approved: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
