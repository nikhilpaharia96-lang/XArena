import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { searchUsers } from "@/server/lib/friends";

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!checkRateLimit(`friend-search:${me.id}`, 30, 60_000).allowed) {
      throw new ApiError(429, "Too many searches. Wait a moment.", "RATE_LIMITED");
    }
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok({ users: searchUsers(db, me.id, q.slice(0, 40)) });
  } catch (error) {
    return fail(error);
  }
}
