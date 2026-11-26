import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { transferCaptain } from "@/server/lib/teams";

const schema = z.object({ userId: z.string().min(1).max(100) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    const { userId } = schema.parse(await req.json().catch(() => ({})));
    transferCaptain(db, me.id, (await params).id, userId);
    return ok({ transferred: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
