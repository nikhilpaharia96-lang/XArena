import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM User").get() as { c: number }).c;
    const activeUsers = (
      db.prepare("SELECT COUNT(*) as c FROM User WHERE status = 'ACTIVE'").get() as { c: number }
    ).c;
    const totalTournaments = (db.prepare("SELECT COUNT(*) as c FROM Tournament").get() as { c: number }).c;
    const liveTournaments = (
      db.prepare("SELECT COUNT(*) as c FROM Tournament WHERE status = 'LIVE'").get() as { c: number }
    ).c;

    const totalDeposits = db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM Deposit WHERE status = 'COMPLETED'")
      .get() as { total: number };
    const totalWithdrawals = db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM WithdrawRequest WHERE status IN ('APPROVED','PAID')")
      .get() as { total: number };
    const totalEntryFees = db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM \"Transaction\" WHERE type = 'TOURNAMENT_ENTRY' AND status = 'COMPLETED'")
      .get() as { total: number };
    const totalPrizesAwarded = db
      .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM \"Transaction\" WHERE type = 'TOURNAMENT_PRIZE' AND status = 'COMPLETED'")
      .get() as { total: number };

    // Revenue = entry fees collected minus prizes paid out (platform's simplified take).
    const revenue = totalEntryFees.total - totalPrizesAwarded.total;

    const pendingWithdrawals = (
      db.prepare("SELECT COUNT(*) as c FROM WithdrawRequest WHERE status = 'PENDING'").get() as { c: number }
    ).c;
    const pendingResults = (
      db
        .prepare("SELECT COUNT(*) as c FROM MatchResult WHERE verifiedAt IS NULL AND isDisputed = 0")
        .get() as { c: number }
    ).c;
    const openTickets = (
      db.prepare("SELECT COUNT(*) as c FROM SupportTicket WHERE status = 'OPEN'").get() as { c: number }
    ).c;

    // 14-day growth series for signups and deposits, for dashboard charts.
    const signupSeries = db
      .prepare(
        `SELECT date(createdAt) as day, COUNT(*) as count FROM User
         WHERE createdAt >= date('now', '-14 days') GROUP BY day ORDER BY day ASC`
      )
      .all();
    const depositSeries = db
      .prepare(
        `SELECT date(createdAt) as day, COALESCE(SUM(amount), 0) as total FROM Deposit
         WHERE status = 'COMPLETED' AND createdAt >= date('now', '-14 days') GROUP BY day ORDER BY day ASC`
      )
      .all();

    const recentActivity = db
      .prepare(
        `SELECT al.id, al.action, al.targetType, al.targetId, al.createdAt, u.username as actorUsername
         FROM AuditLog al LEFT JOIN User u ON u.id = al.actorId
         ORDER BY al.createdAt DESC LIMIT 20`
      )
      .all();

    return ok({
      kpis: {
        totalUsers,
        activeUsers,
        totalTournaments,
        liveTournaments,
        totalDeposits: totalDeposits.total,
        totalWithdrawals: totalWithdrawals.total,
        totalEntryFees: totalEntryFees.total,
        totalPrizesAwarded: totalPrizesAwarded.total,
        revenue,
        pendingWithdrawals,
        pendingResults,
        openTickets,
      },
      signupSeries,
      depositSeries,
      recentActivity,
    });
  } catch (error) {
    return fail(error);
  }
}
