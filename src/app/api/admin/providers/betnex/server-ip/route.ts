import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { detectOutboundIp } from "@/server/lib/server-ip";

export const dynamic = "force-dynamic";

/** Admin only: the public IP this server uses for outbound calls (for provider IP allowlists). */
export async function GET() {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    if (!checkRateLimit(`server-ip:${admin.id}`, 10, 60_000).allowed) throw new ApiError(429, "Slow down.", "RATE_LIMITED");
    return ok({ ...(await detectOutboundIp()), checkedAt: new Date().toISOString() });
  } catch (error) {
    return fail(error);
  }
}
