import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";

/** Public: the hero slides currently live (active and inside their schedule window), in display order. */
export async function GET() {
  try {
    const now = new Date().toISOString();
    const rows = db
      .prepare(
        `SELECT id, title, subtitle, badgeText, imageUrl, mobileImageUrl, linkUrl, ctaLabel, secondaryCtaLabel, secondaryCtaUrl
         FROM Banner
         WHERE isActive = 1 AND (startsAt IS NULL OR startsAt <= ?) AND (endsAt IS NULL OR endsAt > ?)
         ORDER BY sortOrder ASC, createdAt DESC
         LIMIT 8`
      )
      .all(now, now);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}
