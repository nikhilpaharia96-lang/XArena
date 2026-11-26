import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { disbandTeam, getTeamDetail, updateTeam } from "@/server/lib/teams";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    return ok(getTeamDetail(db, me.id, (await params).id));
  } catch (error) {
    return fail(error);
  }
}

const patchSchema = z.object({ name: z.string().max(60).optional(), tag: z.string().max(10).optional() });

/** Captain renames the team / changes its tag. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    const input = patchSchema.parse(await req.json().catch(() => ({})));
    updateTeam(db, me.id, (await params).id, input);
    return ok({ updated: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}

/** Captain disbands the team. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await getCurrentUser();
    disbandTeam(db, me.id, (await params).id);
    return ok({ disbanded: true });
  } catch (error) {
    return fail(error);
  }
}
