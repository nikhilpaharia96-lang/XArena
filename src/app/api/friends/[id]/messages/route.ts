import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { getMessages, sendMessage } from "@/server/lib/friends";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    const { id } = await context.params;
    return ok(getMessages(db, me.id, id));
  } catch (error) {
    return fail(error);
  }
}

const bodySchema = z.object({ body: z.string() });

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!checkRateLimit(`dm:${me.id}`, 30, 60_000).allowed) {
      throw new ApiError(429, "You're sending messages too fast. Slow down a little.", "RATE_LIMITED");
    }
    const { id } = await context.params;
    const { body } = bodySchema.parse(await req.json().catch(() => ({})));
    return ok(sendMessage(db, me.id, id, body), 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
