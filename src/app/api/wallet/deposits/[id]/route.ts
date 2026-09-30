import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { getDepositRequest } from "@/server/lib/deposit-requests";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const row = getDepositRequest(id);
    // 404 (not 403) for other people's requests so ids can't be probed.
    if (!row || row.userId !== user.id) throw new ApiError(404, "Deposit request not found.", "NOT_FOUND");
    return ok(row);
  } catch (error) {
    return fail(error);
  }
}
