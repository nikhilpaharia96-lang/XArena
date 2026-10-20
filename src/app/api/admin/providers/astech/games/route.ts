import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { PROVIDER_ID } from "@/server/providers/astech/astech.config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const u = new URL(req.url);
    const where: string[] = ["provider = ?"];
    const args: unknown[] = [PROVIDER_ID];
    const category = u.searchParams.get("category");
    const providerName = u.searchParams.get("provider");
    const enabled = u.searchParams.get("enabled");
    const search = u.searchParams.get("search")?.trim().slice(0, 60);
    if (category) { where.push("category = ?"); args.push(category); }
    if (providerName) { where.push("providerName = ?"); args.push(providerName); }
    if (enabled === "1" || enabled === "0") { where.push("isEnabled = ?"); args.push(Number(enabled)); }
    if (search) { where.push("(title LIKE ? OR providerGameId LIKE ?)"); args.push(`%${search}%`, `%${search}%`); }

    const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
    const limit = 50;
    const total = (db.prepare(`SELECT COUNT(*) c FROM ProviderGame WHERE ${where.join(" AND ")}`).get(...args) as { c: number }).c;
    const rows = db
      .prepare(
        `SELECT id, providerGameId, title, providerName, category, imageUrl, currencies, isEnabled, isAvailable, lastSyncedAt
         FROM ProviderGame WHERE ${where.join(" AND ")} ORDER BY providerName, title LIMIT ? OFFSET ?`
      )
      .all(...args, limit, (page - 1) * limit) as { currencies: string; isEnabled: number; isAvailable: number }[];

    const facets = {
      categories: (db.prepare("SELECT DISTINCT category v FROM ProviderGame WHERE provider = ? ORDER BY v").all(PROVIDER_ID) as { v: string }[]).map((r) => r.v),
      providers: (db.prepare("SELECT DISTINCT providerName v FROM ProviderGame WHERE provider = ? ORDER BY v").all(PROVIDER_ID) as { v: string }[]).map((r) => r.v),
    };
    return ok({
      games: rows.map((r) => ({ ...r, currencies: JSON.parse(r.currencies) as string[], isEnabled: Boolean(r.isEnabled), isAvailable: Boolean(r.isAvailable) })),
      facets,
      pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return fail(error);
  }
}
