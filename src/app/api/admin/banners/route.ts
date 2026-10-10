import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";
import { imageRefSchema } from "@/server/lib/admin-schemas";

const bannerSchema = z.object({
  title: z.string().trim().min(1).max(120),
  imageUrl: imageRefSchema,
  linkUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const rows = db.prepare("SELECT * FROM Banner ORDER BY sortOrder ASC, createdAt DESC").all() as {
      isActive: number;
      [k: string]: unknown;
    }[];
    return ok(rows.map((b) => ({ ...b, isActive: Boolean(b.isActive) })));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const body = await req.json();
    const input = bannerSchema.parse(body);

    const id = createId("banner");
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO Banner (id, title, imageUrl, linkUrl, sortOrder, isActive, startsAt, endsAt, createdAt)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).run(id, input.title, input.imageUrl, input.linkUrl ?? null, input.sortOrder, input.startsAt ?? null, input.endsAt ?? null, now);

    writeAuditLog({ actorId: admin.id, action: "BANNER_CREATED", targetType: "Banner", targetId: id });
    return ok({ id }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
