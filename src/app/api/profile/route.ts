import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { z } from "zod";

const updateProfileSchema = z.object({
  displayName: z.string().trim().max(30).optional(),
  avatarUrl: z.string().url().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number")
    .optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();

    const profileRow = db
      .prepare(
        `SELECT id, uid, email, username, displayName, avatarUrl, phone, emailVerified, createdAt
         FROM User WHERE id = ?`
      )
      .get(user.id) as { emailVerified: number; [k: string]: unknown };
    const profile = { ...profileRow, emailVerified: Boolean(profileRow.emailVerified) };

    const stats = db.prepare("SELECT * FROM PlayerStats WHERE userId = ?").get(user.id);

    const tournamentHistory = db
      .prepare(
        `SELECT t.id, t.slug, t.title, t.bannerUrl, t.status, t.matchStartsAt, t.gameId, tp.status as participantStatus, tp.joinedAt, tp.teamName
         FROM TournamentParticipant tp JOIN Tournament t ON t.id = tp.tournamentId
         WHERE tp.userId = ? ORDER BY tp.joinedAt DESC LIMIT 20`
      )
      .all(user.id);

    return ok({ profile, stats, tournamentHistory });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const input = updateProfileSchema.parse(body);

    const fields: string[] = [];
    const values: (string | number)[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new ApiError(400, "No fields to update.", "NO_FIELDS");
    }

    fields.push("updatedAt = ?");
    values.push(new Date().toISOString());
    values.push(user.id);

    db.prepare(`UPDATE User SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return ok({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
