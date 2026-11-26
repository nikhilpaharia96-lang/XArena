import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { cancelInvite, respondToInvite } from "@/server/lib/teams";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["accept", "decline"]) });

/** The invited player accepts or declines. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    const { action } = schema.parse(await req.json().catch(() => ({})));
    return ok(respondToInvite(db, me.id, (await params).id, action === "accept"));
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}

/** The captain cancels a pending invite. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    cancelInvite(db, me.id, (await params).id);
    return ok({ cancelled: true });
  } catch (error) {
    return fail(error);
  }
}
