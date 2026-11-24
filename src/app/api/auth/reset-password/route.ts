import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { hashPassword } from "@/server/lib/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { resetPasswordSchema } from "@/types/schemas";
import { consumeResetToken, isResetTokenValid } from "@/server/lib/password-reset";

const INVALID = "This reset link is invalid or has expired. Please request a new one.";

/** Lets the page check a link before showing the form. */
export async function GET(req: Request) {
  try {
    if (!checkRateLimit(`reset-check:${getClientKey(req)}`, 30, 15 * 60_000).allowed) {
      throw new ApiError(429, "Too many requests. Please try again in a few minutes.");
    }
    const token = new URL(req.url).searchParams.get("token") ?? "";
    return ok({ valid: token.length >= 20 && isResetTokenValid(db, token) });
  } catch (error) {
    return fail(error);
  }
}

/** Sets a new password from a valid link, then signs the user out everywhere. */
export async function POST(req: Request) {
  try {
    if (!checkRateLimit(`reset:${getClientKey(req)}`, 10, 15 * 60_000).allowed) {
      throw new ApiError(429, "Too many attempts. Please try again in a few minutes.");
    }
    const input = resetPasswordSchema.parse(await req.json());

    // Cheap check first so bad tokens don't cost a bcrypt hash.
    if (!isResetTokenValid(db, input.token)) throw new ApiError(400, INVALID, "INVALID_RESET_TOKEN");

    const userId = consumeResetToken(db, input.token, await hashPassword(input.password));
    if (!userId) throw new ApiError(400, INVALID, "INVALID_RESET_TOKEN");

    writeAuditLog({ actorId: userId, action: "PASSWORD_RESET_SELF", targetType: "User", targetId: userId, ipAddress: getClientKey(req) });
    return ok({ reset: true });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
