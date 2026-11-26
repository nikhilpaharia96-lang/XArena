import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { badgeCounts, listFriends, listRequests } from "@/server/lib/friends";

/** Friends (with last message + unread), pending requests, and badge counts — one cheap call for polling. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    return ok({
      friends: listFriends(db, me.id),
      ...listRequests(db, me.id),
      counts: badgeCounts(db, me.id),
    });
  } catch (error) {
    return fail(error);
  }
}
