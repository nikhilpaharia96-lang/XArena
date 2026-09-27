import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  target: z.enum(["all", "active", "specific"]).default("all"),
  userIds: z.array(z.string()).optional(), // required when target === "specific"
});

/**
 * Fans out an ANNOUNCEMENT notification to the targeted audience. The
 * in-app Notification rows are created for real, for every targeted user,
 * inside one transaction. Push delivery via FCM is the piece still pending
 * credentials — see TODO below; email broadcast likewise needs SMTP.
 *
 * TODO(FCM_CREDENTIALS): once a Firebase service account is configured,
 * batch-send via admin.messaging().sendEachForMulticast() using each
 * user's PushToken rows, chunked into groups of 500 per FCM's limit.
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const body = await req.json();
    const input = broadcastSchema.parse(body);

    let targetUserIds: string[];
    if (input.target === "specific") {
      if (!input.userIds || input.userIds.length === 0) {
        throw new ApiError(400, "userIds is required when target is 'specific'.", "VALIDATION_ERROR");
      }
      targetUserIds = input.userIds;
    } else if (input.target === "active") {
      const rows = db.prepare("SELECT id FROM User WHERE status = 'ACTIVE'").all() as { id: string }[];
      targetUserIds = rows.map((r) => r.id);
    } else {
      const rows = db.prepare("SELECT id FROM User").all() as { id: string }[];
      targetUserIds = rows.map((r) => r.id);
    }

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'ANNOUNCEMENT', ?, ?, ?)`
    );
    const insertMany = db.transaction((ids: string[]) => {
      for (const userId of ids) {
        insert.run(createId("notif"), userId, input.title, input.body, now);
      }
    });
    insertMany(targetUserIds);

    writeAuditLog({
      actorId: admin.id,
      action: "NOTIFICATION_BROADCAST",
      metadata: { target: input.target, recipientCount: targetUserIds.length, title: input.title },
    });

    return ok({ sent: true, recipientCount: targetUserIds.length, pushDelivered: false });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
