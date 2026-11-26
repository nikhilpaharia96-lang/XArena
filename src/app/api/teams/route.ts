import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { createTeam, listMyInvites, listMyTeams } from "@/server/lib/teams";

/** My teams + the team invites waiting for my answer. */
export async function GET() {
  try {
    const me = await getCurrentUser();
    return ok({ teams: listMyTeams(db, me.id), invites: listMyInvites(db, me.id) });
  } catch (error) {
    return fail(error);
  }
}

const createSchema = z.object({
  name: z.string().max(60),
  tag: z.string().max(10),
  gameId: z.string().min(1).max(100),
  ign: z.string().max(60).optional(),
  gameUid: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!checkRateLimit(`team-create:${me.id}`, 10, 60 * 60_000).allowed) {
      throw new ApiError(429, "You're creating teams too fast. Try again later.", "RATE_LIMITED");
    }
    const input = createSchema.parse(await req.json().catch(() => ({})));
    return ok(createTeam(db, me.id, input), 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
