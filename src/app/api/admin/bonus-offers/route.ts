import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { writeAuditLog } from "@/server/lib/audit";
import { listOffers, saveOffer, type OfferInput } from "@/server/lib/deposit-bonus";

export async function GET() {
  try {
    requireRole(await getCurrentUser(), "ADMIN", "SUPER_ADMIN");
    return ok(listOffers(db));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const body = (await req.json()) as OfferInput;
    const id = saveOffer(db, body);
    writeAuditLog({ actorId: admin.id, action: "BONUS_OFFER_CREATED", targetType: "DepositBonusOffer", targetId: id, metadata: { ...body }, ipAddress: getClientKey(req) });
    return ok({ id }, 201);
  } catch (error) {
    return fail(error);
  }
}
