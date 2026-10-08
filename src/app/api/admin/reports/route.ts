import { db } from "@/server/db/client";
import { ApiError, fail } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { NextResponse } from "next/server";
import { formatPhoneForExport } from "@/lib/phone";

type Row = Record<string, unknown>;

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

/**
 * GET /api/admin/reports?type=revenue|tournaments|users|referrals|payments
 * Streams a CSV file. Every export is audit-logged since financial/user
 * data leaving the system through a download is itself a sensitive action.
 */
export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    let rows: Row[];
    switch (type) {
      case "revenue":
        rows = db
          .prepare(
            `SELECT date(createdAt) as date, type, status, COUNT(*) as count, SUM(amount) as totalAmountPaise
             FROM "Transaction" GROUP BY date(createdAt), type, status ORDER BY date DESC`
          )
          .all() as Row[];
        break;
      case "tournaments":
        rows = db
          .prepare(
            `SELECT t.slug, t.title, g.name as game, t.mode, t.format, t.status, t.entryFee, t.prizePool,
                    t.maxSlots, t.slotsFilled, t.matchStartsAt, t.createdAt
             FROM Tournament t JOIN Game g ON g.id = t.gameId ORDER BY t.createdAt DESC`
          )
          .all() as Row[];
        break;
      case "users":
        rows = db
          .prepare(
            `SELECT u.uid, u.username, u.email, u.phone, u.status, u.role, u.createdAt, u.lastLoginAt,
                    w.depositBalance, w.winningBalance, w.bonusBalance,
                    ps.matchesPlayed, ps.wins, ps.totalEarnings
             FROM User u
             LEFT JOIN Wallet w ON w.userId = u.id
             LEFT JOIN PlayerStats ps ON ps.userId = u.id
             ORDER BY u.createdAt DESC`
          )
          .all() as Row[];
        rows = rows.map((r) => ({ ...r, phone: formatPhoneForExport(r.phone as string | null) }));
        break;
      case "referrals":
        rows = db
          .prepare(
            `SELECT r.createdAt, referrer.username as referrer, referred.username as referredUser, r.bonusAmount, r.bonusPaidAt
             FROM Referral r
             JOIN User referrer ON referrer.id = r.referrerId
             JOIN User referred ON referred.id = r.referredUserId
             ORDER BY r.createdAt DESC`
          )
          .all() as Row[];
        break;
      case "payments":
        rows = db
          .prepare(
            `SELECT d.createdAt, u.username, u.email, u.phone, d.amount, d.status, d.razorpayOrderId, d.razorpayPaymentId
             FROM Deposit d JOIN User u ON u.id = d.userId ORDER BY d.createdAt DESC`
          )
          .all() as Row[];
        rows = rows.map((r) => ({ ...r, phone: formatPhoneForExport(r.phone as string | null) }));
        break;
      default:
        throw new ApiError(400, "Invalid report type. Use revenue, tournaments, users, referrals, or payments.", "INVALID_TYPE");
    }

    writeAuditLog({ actorId: admin.id, action: "REPORT_EXPORTED", metadata: { type, rowCount: rows.length } });

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="xarena-${type}-report-${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
