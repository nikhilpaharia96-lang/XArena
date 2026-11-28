import { z } from "zod";
import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { PROVIDER_ID } from "@/server/providers/betnex/betnex.config";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    enabled: z.boolean(),
    /** Narrow to one game studio, one category, or both. */
    providerName: z.string().trim().min(1).max(80).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    /** Must be set explicitly to switch EVERY game (guards against an empty filter by mistake). */
    all: z.boolean().optional(),
  })
  .refine((b) => b.providerName || b.category || b.all, { message: "Choose a provider, a category, or all" });

/** Bulk enable/disable of synced BETNEX games (new games start disabled). */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const b = bodySchema.parse(await req.json());

    const where = ["provider = ?", "isAvailable = 1"];
    const args: unknown[] = [PROVIDER_ID];
    if (b.providerName) {
      where.push("providerName = ?");
      args.push(b.providerName);
    }
    if (b.category) {
      where.push("category = ?");
      args.push(b.category);
    }
    const res = db.prepare(`UPDATE ProviderGame SET isEnabled = ?, updatedAt = ? WHERE ${where.join(" AND ")}`).run(b.enabled ? 1 : 0, new Date().toISOString(), ...args);
    if (res.changes === 0) throw new ApiError(404, "No matching games.", "NOT_FOUND");

    writeAuditLog({
      actorId: admin.id,
      action: b.enabled ? "BETNEX_ENABLE_GAMES" : "BETNEX_DISABLE_GAMES",
      targetType: "Provider",
      targetId: "betnex",
      metadata: { providerName: b.providerName ?? null, category: b.category ?? null, all: b.all ?? false, changed: res.changes },
    });
    return ok({ changed: res.changes });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
