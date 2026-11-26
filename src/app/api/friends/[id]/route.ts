import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { removeFriendship } from "@/server/lib/friends";

/** Unfriend (deletes the chat) or cancel an outgoing request. */
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    const { id } = await context.params;
    removeFriendship(db, me.id, id);
    return ok({ removed: true });
  } catch (error) {
    return fail(error);
  }
}
