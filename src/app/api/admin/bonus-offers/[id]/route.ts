import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { getClientKey } from "@/server/lib/rate-limit";
import { writeAuditLog } from "@/server/lib/audit";
import { deleteOffer, saveOffer, type OfferInput } from "@/server/lib/deposit-bonus";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const body = (await req.json()) as OfferInput;
    saveOffer(db, body, id);
    writeAuditLog({ actorId: admin.id, action: "BONUS_OFFER_UPDATED", targetType: "DepositBonusOffer", targetId: id, metadata: { ...body }, ipAddress: getClientKey(req) });
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    deleteOffer(db, id);
    writeAuditLog({ actorId: admin.id, action: "BONUS_OFFER_DELETED", targetType: "DepositBonusOffer", targetId: id, metadata: {}, ipAddress: getClientKey(req) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
