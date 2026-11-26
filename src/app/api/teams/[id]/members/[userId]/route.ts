import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { removeMember } from "@/server/lib/teams";

/** userId = me → leave the team; otherwise the captain removes that member. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const me = await getCurrentUser();
    const { id, userId } = await params;
    removeMember(db, me.id, id, userId);
    return ok({ removed: true });
  } catch (error) {
    return fail(error);
  }
}
