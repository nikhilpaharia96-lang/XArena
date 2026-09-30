import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { listDepositRequests } from "@/server/lib/deposit-requests";

export async function GET(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");

    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return ok({ requests: [], counts: { PENDING: 0, APPROVED: 0, REJECTED: 0 } });
    }

    const requests = listDepositRequests({ status, limit: 200 });
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<string, number>;
    for (const r of db.prepare("SELECT status, COUNT(*) as c FROM DepositRequest GROUP BY status").all() as {
      status: string;
      c: number;
    }[]) {
      counts[r.status] = r.c;
    }
    return ok({ requests, counts });
  } catch (error) {
    return fail(error);
  }
}
