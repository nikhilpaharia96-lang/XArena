import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";

export async function GET() {
  try {
    const games = db
      .prepare(
        `SELECT id, slug, name, shortName, iconUrl, bannerUrl, supportedModes
         FROM Game WHERE isActive = 1 ORDER BY sortOrder ASC`
      )
      .all();

    const parsed = games.map((g) => {
      const game = g as { supportedModes: string; [k: string]: unknown };
      return { ...game, supportedModes: JSON.parse(game.supportedModes) };
    });

    return ok(parsed);
  } catch (error) {
    return fail(error);
  }
}
