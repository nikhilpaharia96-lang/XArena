import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { respondToRequest } from "@/server/lib/friends";

const bodySchema = z.object({ action: z.enum(["accept", "decline"]) });

/** Accept or decline a request that was sent to the current user. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    const { id } = await context.params;
    const { action } = bodySchema.parse(await req.json().catch(() => ({})));
    return ok(respondToRequest(db, me.id, id, action === "accept"));
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
