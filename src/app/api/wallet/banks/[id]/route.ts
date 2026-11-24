import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    // Past withdrawals keep their own snapshot of the bank details, so deleting is always safe.
    const res = db.prepare("DELETE FROM BankAccount WHERE id = ? AND userId = ?").run(id, user.id);
    if (res.changes === 0) throw new ApiError(404, "Bank account not found.", "NOT_FOUND");
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
