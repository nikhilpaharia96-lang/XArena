import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { sendFriendRequest } from "@/server/lib/friends";

const bodySchema = z.object({ userId: z.string().min(1).max(100) });

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!checkRateLimit(`friend-req:${me.id}`, 20, 60 * 60_000).allowed) {
      throw new ApiError(429, "You're sending too many friend requests. Try again later.", "RATE_LIMITED");
    }
    const { userId } = bodySchema.parse(await req.json().catch(() => ({})));
    return ok(sendFriendRequest(db, me.id, userId), 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
