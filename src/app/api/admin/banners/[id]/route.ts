import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { scheduleIssue, updateBannerSchema, type BannerRow } from "@/server/lib/banners";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const existing = db.prepare("SELECT * FROM Banner WHERE id = ?").get(id) as BannerRow | undefined;
    if (!existing) throw new ApiError(404, "Banner not found.", "NOT_FOUND");

    const input = updateBannerSchema.parse(await req.json());
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
    if (Object.keys(patch).length === 0) throw new ApiError(400, "Nothing to update.", "VALIDATION_ERROR");

    const issue = scheduleIssue(
      (patch.startsAt as string | null | undefined) ?? (patch.startsAt === null ? null : existing.startsAt),
      (patch.endsAt as string | null | undefined) ?? (patch.endsAt === null ? null : existing.endsAt)
    );
    if (issue) throw new ApiError(400, issue, "VALIDATION_ERROR");

    // Column names come from the zod-validated keys above (a fixed allow-list), never from raw input.
    const cols = Object.keys(patch);
    const values = cols.map((c) => (c === "isActive" ? (patch[c] ? 1 : 0) : patch[c]));
    db.prepare(`UPDATE Banner SET ${cols.map((c) => `${c} = ?`).join(", ")}, updatedAt = ? WHERE id = ?`).run(
      ...(values as (string | number | null)[]),
      new Date().toISOString(),
      id
    );

    const action = cols.length === 1 && cols[0] === "isActive" ? (patch.isActive ? "BANNER_ENABLED" : "BANNER_DISABLED") : "BANNER_UPDATED";
    writeAuditLog({ actorId: admin.id, action, targetType: "Banner", targetId: id, metadata: { fields: cols } });
    return ok({ id });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const existing = db.prepare("SELECT title FROM Banner WHERE id = ?").get(id) as { title: string } | undefined;
    if (!existing) throw new ApiError(404, "Banner not found.", "NOT_FOUND");
    db.prepare("DELETE FROM Banner WHERE id = ?").run(id);
    writeAuditLog({ actorId: admin.id, action: "BANNER_DELETED", targetType: "Banner", targetId: id, metadata: { title: existing.title } });
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}
