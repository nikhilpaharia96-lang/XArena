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
    const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
    const limit = 50;
    const status = u.searchParams.get("status");
    const where = ["t.provider = ?"];
    const args: unknown[] = [PROVIDER_ID];
    if (status) { where.push("t.status = ?"); args.push(status); }
    const total = (db.prepare(`SELECT COUNT(*) c FROM ProviderTransaction t WHERE ${where.join(" AND ")}`).get(...args) as { c: number }).c;
    const rows = db
      .prepare(
        `SELECT t.id, t.providerTransactionId, t.roundId, t.providerGameId, t.betAmount, t.winAmount, t.currency, t.status,
                t.roundFinished, t.balanceAfter, t.createdAt, u.username
         FROM ProviderTransaction t JOIN User u ON u.id = t.userId
         WHERE ${where.join(" AND ")} ORDER BY t.createdAt DESC LIMIT ? OFFSET ?`
      )
      .all(...args, limit, (page - 1) * limit);
    return ok({ transactions: rows, pagination: { page, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return fail(error);
  }
}
