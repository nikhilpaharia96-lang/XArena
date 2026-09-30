import { db } from "@/server/db/client";
import { ApiError, fail } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { readUpload } from "@/server/lib/uploads";

/** Payment proof is private: only the owner or an admin can view it. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const row = db.prepare("SELECT userId, screenshotUrl FROM DepositRequest WHERE id = ?").get(id) as
      | { userId: string; screenshotUrl: string }
      | undefined;

    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user.role);
    if (!row || (row.userId !== user.id && !isAdmin)) {
      throw new ApiError(404, "Screenshot not found.", "NOT_FOUND");
    }
    const file = readUpload(row.screenshotUrl);
    if (!file) throw new ApiError(404, "Screenshot not found.", "NOT_FOUND");

    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
