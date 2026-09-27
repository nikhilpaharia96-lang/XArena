import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? 25), 100);
    const offset = (page - 1) * pageSize;

    let query = `
      SELECT u.id, u.uid, u.email, u.username, u.role, u.status, u.createdAt, u.lastLoginAt,
             w.depositBalance, w.winningBalance, w.bonusBalance
      FROM User u LEFT JOIN Wallet w ON w.userId = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search) {
      query += " AND (u.email LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      query += " AND u.status = ?";
      params.push(status);
    }
    query += " ORDER BY u.createdAt DESC LIMIT ? OFFSET ?";
    params.push(pageSize, offset);

    const users = db.prepare(query).all(...params);

    let countQuery = "SELECT COUNT(*) as count FROM User u WHERE 1=1";
    const countParams: (string | number)[] = [];
    if (search) {
      countQuery += " AND (u.email LIKE ? OR u.username LIKE ? OR u.uid LIKE ?)";
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      countQuery += " AND u.status = ?";
      countParams.push(status);
    }
    const { count } = db.prepare(countQuery).get(...countParams) as { count: number };

    return ok({ users, pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) } });
  } catch (error) {
    return fail(error);
  }
}
