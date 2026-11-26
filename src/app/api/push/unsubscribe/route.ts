import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { removeSubscription } from "@/server/lib/push";

const schema = z.object({ endpoint: z.string().max(2048) });

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { endpoint } = schema.parse(await req.json().catch(() => ({})));
    removeSubscription(db, user.id, endpoint);
    return ok({ unsubscribed: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
