import { z } from "zod";
import { db } from "@/server/db/client";
import { fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

/** Persists a new slide order: position in `ids` becomes the sortOrder. */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { ids } = schema.parse(await req.json());
    const update = db.prepare("UPDATE Banner SET sortOrder = ?, updatedAt = ? WHERE id = ?");
    const now = new Date().toISOString();
    db.transaction(() => ids.forEach((id, i) => update.run(i, now, id)))();
    writeAuditLog({ actorId: admin.id, action: "BANNER_REORDERED", targetType: "Banner" });
    return ok({ count: ids.length });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
