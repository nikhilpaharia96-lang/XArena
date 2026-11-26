import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { inviteMember } from "@/server/lib/teams";

const schema = z.object({ userId: z.string().min(1).max(100) });

/** Captain invites an accepted friend. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!checkRateLimit(`team-invite:${me.id}`, 30, 60 * 60_000).allowed) {
      throw new ApiError(429, "Too many invites. Try again later.", "RATE_LIMITED");
    }
    const { userId } = schema.parse(await req.json().catch(() => ({})));
    return ok(inviteMember(db, me.id, (await params).id, userId), 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
