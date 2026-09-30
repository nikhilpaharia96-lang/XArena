import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getDepositRequest } from "@/server/lib/deposit-requests";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const row = getDepositRequest(id);
    if (!row) throw new ApiError(404, "Deposit request not found.", "NOT_FOUND");
    return ok(row);
  } catch (error) {
    return fail(error);
  }
}
