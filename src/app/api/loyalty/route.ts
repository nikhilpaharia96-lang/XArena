import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { loyaltySummary } from "@/server/lib/loyalty";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(loyaltySummary(db, user.id));
  } catch (error) {
    return fail(error);
  }
}
