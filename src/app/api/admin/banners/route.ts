import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { writeAuditLog } from "@/server/lib/audit";
import { createBannerSchema, scheduleIssue, type BannerRow } from "@/server/lib/banners";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const rows = db.prepare("SELECT * FROM Banner ORDER BY sortOrder ASC, createdAt DESC").all() as BannerRow[];
    return ok(rows.map((b) => ({ ...b, isActive: Boolean(b.isActive) })));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const input = createBannerSchema.parse(await req.json());
    const issue = scheduleIssue(input.startsAt, input.endsAt);
    if (issue) throw new ApiError(400, issue, "VALIDATION_ERROR");

    const id = createId("banner");
    const now = new Date().toISOString();
    const next = (db.prepare("SELECT COALESCE(MAX(sortOrder), -1) + 1 AS n FROM Banner").get() as { n: number }).n;

    db.prepare(
      `INSERT INTO Banner (id, title, subtitle, badgeText, imageUrl, mobileImageUrl, linkUrl, ctaLabel,
         secondaryCtaLabel, secondaryCtaUrl, sortOrder, isActive, startsAt, endsAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.title,
      input.subtitle ?? null,
      input.badgeText ?? null,
      input.imageUrl,
      input.mobileImageUrl ?? null,
      input.linkUrl ?? null,
      input.ctaLabel ?? null,
      input.secondaryCtaLabel ?? null,
      input.secondaryCtaUrl ?? null,
      input.sortOrder ?? next,
      input.isActive === false ? 0 : 1,
      input.startsAt ?? null,
      input.endsAt ?? null,
      now,
      now
    );

    writeAuditLog({ actorId: admin.id, action: "BANNER_CREATED", targetType: "Banner", targetId: id, metadata: { title: input.title } });
    return ok({ id }, 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
