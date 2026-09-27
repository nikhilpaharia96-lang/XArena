import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { hashPassword } from "@/server/lib/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { randomBytes } from "node:crypto";

/**
 * Generates a temporary password and hashes+stores it for real — this is
 * not mocked. What's missing is delivery: without SMTP credentials we can't
 * email it to the user, so it's returned directly to the admin to relay
 * manually for now.
 *
 * TODO(SMTP_CREDENTIALS): once SMTP_HOST/PORT/USER/PASS (or a transactional
 * email provider API key — Resend/SendGrid/Postmark) are configured, replace
 * the direct return below with an email send and stop returning the
 * password in the API response.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;

    const target = db.prepare("SELECT id, email FROM User WHERE id = ?").get(id) as
      | { id: string; email: string }
      | undefined;
    if (!target) throw new ApiError(404, "User not found.", "NOT_FOUND");

    const tempPassword = randomBytes(6).toString("base64url"); // e.g. "aZ3-kP9xQw"
    const passwordHash = await hashPassword(tempPassword);

    db.prepare("UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?").run(
      passwordHash,
      new Date().toISOString(),
      id
    );

    // Revoke sessions so the old password/session can't keep the account open.
    db.prepare("UPDATE Session SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run(
      new Date().toISOString(),
      id
    );

    writeAuditLog({ actorId: admin.id, action: "PASSWORD_RESET_BY_ADMIN", targetType: "User", targetId: id });

    return ok({
      reset: true,
      temporaryPassword: tempPassword,
      emailSent: false,
      note: "SMTP not configured — relay this password to the user manually, or configure SMTP to enable automatic delivery.",
    });
  } catch (error) {
    return fail(error);
  }
}
