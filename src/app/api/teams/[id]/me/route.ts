import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { updateMyDetails } from "@/server/lib/teams";

const schema = z.object({ ign: z.string().max(60), gameUid: z.string().max(60) });

/** A member sets their own in-game name + UID for this team's game. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    const input = schema.parse(await req.json().catch(() => ({})));
    updateMyDetails(db, me.id, (await params).id, input);
    return ok({ updated: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
