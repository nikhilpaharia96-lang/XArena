import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { settleVipRewards, vipSummary } from "@/server/lib/vip";

export async function GET() {
  try {
    const user = await getCurrentUser();
    settleVipRewards(db, user.id); // pays anything due since the last 1st, 2:00 AM IST
    return ok(vipSummary(db, user.id));
  } catch (error) {
    return fail(error);
  }
}
