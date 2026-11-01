import { z } from "zod";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { quickApproveByUtr } from "@/server/lib/deposit-quick-approve";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 50;
const MAX_RUPEES = 1_000_000;

const entry = z
  .object({
    utr: z.string().trim().min(1).max(40),
    amountRupees: z.union([z.number(), z.string()]),
  })
  .strict();
const body = z.object({ entries: z.array(entry).min(1).max(MAX_ENTRIES) }).strict();

/** "₹1,500.50", "500", 500 -> paise, or null when it is not a clean amount with at most 2 decimals. */
function toPaise(v: string | number): number | null {
  const s = String(v).replace(/[₹,\s]|rs\.?/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_RUPEES) return null;
  return Math.round(n * 100);
}

/**
 * POST /api/admin/deposit-requests/quick-approve  { entries: [{ utr, amountRupees }] }
 * Admin-only. Each entry is approved only on an EXACT UTR + amount match with a PENDING request.
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`quickapprove:${admin.id}`, 30, 60_000).allowed) {
      throw new ApiError(429, "Too many attempts. Please wait a minute.", "RATE_LIMITED");
    }
    const { entries } = body.parse(await req.json().catch(() => ({})));
    const ip = getClientKey(req);

    const results = entries.map((e) => {
      const amountPaise = toPaise(e.amountRupees);
      if (amountPaise === null) return { utr: e.utr.toUpperCase(), outcome: "INVALID_AMOUNT" as const };
      return quickApproveByUtr({ utr: e.utr, amountPaise, adminId: admin.id, ipAddress: ip });
    });
    return ok({ results, approved: results.filter((r) => r.outcome === "APPROVED").length });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
