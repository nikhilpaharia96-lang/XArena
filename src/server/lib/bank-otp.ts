import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/lib/api-response";
import { createId } from "@/server/lib/ids";

const TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 30_000;
const MAX_ATTEMPTS = 5;
const OTP_NOTIFICATION_TYPE = "BANK_OTP";

interface OtpRow {
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

function hashCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/**
 * Creates a fresh 6-digit OTP for adding a bank account and delivers it.
 *
 * Delivery is the single seam to swap when an SMS/e-mail provider is connected:
 * today the code is delivered as an in-app notification (there is no SMS gateway
 * configured in this project). Only a SHA-256 hash is stored.
 */
export function issueBankOtp(userId: string): { expiresInSec: number; resendInSec: number } {
  const existing = db.prepare("SELECT createdAt FROM BankOtp WHERE userId = ?").get(userId) as
    | { createdAt: string }
    | undefined;
  if (existing) {
    const wait = OTP_RESEND_MS - (Date.now() - new Date(existing.createdAt).getTime());
    if (wait > 0) {
      throw new ApiError(429, `Please wait ${Math.ceil(wait / 1000)}s before requesting another OTP.`, "OTP_COOLDOWN");
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const nowIso = now.toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO BankOtp (userId, codeHash, expiresAt, attempts, createdAt) VALUES (?, ?, ?, 0, ?)`
    ).run(userId, hashCode(userId, code), new Date(now.getTime() + TTL_MS).toISOString(), nowIso);

    // Keep only the newest code visible in the user's inbox.
    db.prepare("DELETE FROM Notification WHERE userId = ? AND type = ?").run(userId, OTP_NOTIFICATION_TYPE);
    db.prepare(
      `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      createId("ntf"),
      userId,
      OTP_NOTIFICATION_TYPE,
      "Bank verification code",
      `Your OTP to add a bank account is ${code}. It expires in 5 minutes. Never share it with anyone.`,
      nowIso
    );
  })();

  return { expiresInSec: TTL_MS / 1000, resendInSec: OTP_RESEND_MS / 1000 };
}

/** Throws unless `code` matches the user's live OTP. Wrong guesses are counted. */
export function assertBankOtp(userId: string, code: string): void {
  const row = db.prepare("SELECT codeHash, expiresAt, attempts, createdAt FROM BankOtp WHERE userId = ?").get(userId) as
    | OtpRow
    | undefined;
  if (!row) throw new ApiError(400, "Request an OTP first.", "OTP_REQUIRED");

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db.prepare("DELETE FROM BankOtp WHERE userId = ?").run(userId);
    throw new ApiError(400, "OTP expired. Request a new one.", "OTP_EXPIRED");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare("DELETE FROM BankOtp WHERE userId = ?").run(userId);
    throw new ApiError(429, "Too many wrong attempts. Request a new OTP.", "OTP_LOCKED");
  }

  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(userId, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    db.prepare("UPDATE BankOtp SET attempts = attempts + 1 WHERE userId = ?").run(userId);
    throw new ApiError(400, "Incorrect OTP.", "OTP_INVALID");
  }
}

export function clearBankOtp(userId: string): void {
  db.prepare("DELETE FROM BankOtp WHERE userId = ?").run(userId);
  db.prepare("DELETE FROM Notification WHERE userId = ? AND type = ?").run(userId, OTP_NOTIFICATION_TYPE);
}
