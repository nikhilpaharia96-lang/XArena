import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { listGrants, listOffers } from "@/server/lib/deposit-bonus";

/** GET /api/wallet/bonuses — active offers for the deposit page + this player's bonus progress. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ offers: listOffers(db, { activeOnly: true }), grants: listGrants(db, user.id) });
  } catch (error) {
    return fail(error);
  }
}
