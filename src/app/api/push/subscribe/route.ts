import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { createId } from "@/server/lib/ids";
import { pushConfig, saveSubscription } from "@/server/lib/push";

const schema = z.object({
  endpoint: z.string().max(2048),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!pushConfig()) throw new ApiError(503, "Push notifications are not available right now.", "PUSH_DISABLED");
    if (!checkRateLimit(`push-sub:${user.id}`, 20, 60_000).allowed) throw new ApiError(429, "Too many requests.", "RATE_LIMITED");

    const input = schema.parse(await req.json().catch(() => ({})));
    const { created } = saveSubscription(db, user.id, input, req.headers.get("user-agent"));

    if (created) {
      // Goes through the normal pipeline (Notification → outbox → push), so it also proves delivery works.
      db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'SYSTEM', ?, ?, ?, ?)`)
        .run(createId("notif"), user.id, "Notifications are on 🔔", "You'll get tournament, room and wallet updates here.", JSON.stringify({}), new Date().toISOString());
    }
    return ok({ subscribed: true, created });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
