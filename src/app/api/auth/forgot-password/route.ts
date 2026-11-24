import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { forgotPasswordSchema } from "@/types/schemas";
import { isMailerConfigured, sendPasswordResetEmail } from "@/server/lib/mailer";
import { canSelfReset, createResetTicketOnce, createResetToken, findUserByIdentifier } from "@/server/lib/password-reset";

/**
 * Where the emailed link points. Taken from config, never from the request's
 * Host header (which an attacker can spoof to poison reset links).
 */
function resetLinkBase(): string | null {
  const base = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  return base || null;
}

/**
 * Starts a password reset.
 *  - Email configured  -> emails a single-use link (valid 30 min).
 *  - Otherwise         -> opens a support ticket for the admin team.
 * The response only depends on server configuration, never on whether the
 * account exists, so it can't be used to discover registered emails/phones.
 */
export async function POST(req: Request) {
  try {
    if (!checkRateLimit(`forgot:${getClientKey(req)}`, 5, 15 * 60_000).allowed) {
      throw new ApiError(429, "Too many requests. Please try again in a few minutes.");
    }
    const input = forgotPasswordSchema.parse(await req.json());
    if (!checkRateLimit(`forgot-id:${input.identifier.toLowerCase()}`, 3, 60 * 60_000).allowed) {
      throw new ApiError(429, "Too many requests for this account. Please try again later.");
    }

    const base = resetLinkBase();
    const mode: "email" | "support" = isMailerConfigured() && base ? "email" : "support";

    const user = findUserByIdentifier(db, input.identifier);
    if (user && canSelfReset(user)) {
      if (mode === "email") {
        const token = createResetToken(db, user.id);
        try {
          await sendPasswordResetEmail(user.email, `${base}/reset-password?token=${encodeURIComponent(token)}`);
        } catch (e) {
          // Don't tell the caller (that would reveal the account exists); log for the operator.
          console.error("[forgot-password] email send failed:", e instanceof Error ? e.message : e);
        }
      } else {
        createResetTicketOnce(db, user, input.identifier);
      }
    }

    return ok({ mode });
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
