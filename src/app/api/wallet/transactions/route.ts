import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";

/**
 * GET /api/wallet/transactions?type=DEPOSIT&status=COMPLETED&page=1&pageSize=20
 * Cursor-free offset pagination is fine at this scale; swap for keyset
 * pagination (WHERE createdAt < :cursor) if a single user's ledger grows
 * past tens of thousands of rows.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? 20), 50);
    const offset = (page - 1) * pageSize;

    let query = `SELECT id, type, status, amount, balanceAfter, referenceId, description, createdAt FROM "Transaction" WHERE userId = ?`;
    const params: (string | number)[] = [user.id];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
    params.push(pageSize, offset);

    const rows = db.prepare(query).all(...params);

    let countQuery = `SELECT COUNT(*) as count FROM "Transaction" WHERE userId = ?`;
    const countParams: (string | number)[] = [user.id];
    if (type) {
      countQuery += " AND type = ?";
      countParams.push(type);
    }
    if (status) {
      countQuery += " AND status = ?";
      countParams.push(status);
    }
    const { count } = db.prepare(countQuery).get(...countParams) as { count: number };

    return ok({
      transactions: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    });
  } catch (error) {
    return fail(error);
  }
}
