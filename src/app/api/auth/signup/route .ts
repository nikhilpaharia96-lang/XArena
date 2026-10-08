import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { hashPassword, signAccessToken, createRefreshTokenValue, refreshTokenExpiry, ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "@/server/lib/auth";
import { createId, createReferenceId, createReferralCode } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { signupSchema } from "@/types/schemas";
import { cookies } from "next/headers";

const SIGNUP_REFERRAL_BONUS_PAISE = 5000; // ₹50 credited to the referrer

export async function POST(req: Request) {
  try {
    const { allowed } = checkRateLimit(`signup:${getClientKey(req)}`, 5, 60_000);
    if (!allowed) {
      throw new ApiError(429, "Too many signup attempts. Try again in a minute.");
    }

    const body = await req.json();
    const input = signupSchema.parse(body);

    const existingEmail = db.prepare("SELECT id FROM User WHERE email = ?").get(input.email);
    if (existingEmail) {
      throw new ApiError(409, "An account with this email already exists.", "EMAIL_TAKEN");
    }
    const fullPhone = `${input.countryCode}${input.phone}`;
    if (db.prepare("SELECT id FROM User WHERE phone = ?").get(fullPhone)) {
      throw new ApiError(409, "An account with this phone number already exists.", "PHONE_TAKEN");
    }
    const validCodes = (process.env.SIGNUP_CODES ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (validCodes.length > 0 && !validCodes.includes(input.signupCode.toUpperCase())) {
      throw new ApiError(400, "Invalid signup code.", "INVALID_SIGNUP_CODE");
    }
    const existingUsername = db.prepare("SELECT id FROM User WHERE username = ?").get(input.username);
    if (existingUsername) {
      throw new ApiError(409, "That username is already taken.", "USERNAME_TAKEN");
    }

    let referrer: { id: string } | undefined;
    if (input.referralCode) {
      referrer = db
        .prepare("SELECT id FROM User WHERE referralCode = ?")
        .get(input.referralCode) as { id: string } | undefined;
      if (!referrer) {
        throw new ApiError(400, "That referral code doesn't exist.", "INVALID_REFERRAL");
      }
    }

    const passwordHash = await hashPassword(input.password);
    const userId = createId("user");
    const now = new Date().toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO User (id, uid, email, emailVerified, passwordHash, authProvider, username, phone, role, status, referralCode, referredById, createdAt, updatedAt)
         VALUES (@id, @uid, @email, 0, @passwordHash, 'EMAIL', @username, @phone, 'USER', 'ACTIVE', @referralCode, @referredById, @now, @now)`
      ).run({
        id: userId,
        uid: createId(),
        email: input.email,
        passwordHash,
        username: input.username,
        phone: fullPhone,
        referralCode: createReferralCode(),
        referredById: referrer?.id ?? null,
        now,
      });

      db.prepare(
        `INSERT INTO Wallet (id, userId, depositBalance, winningBalance, bonusBalance, lockedBalance, updatedAt)
         VALUES (?, ?, 0, 0, 0, 0, ?)`
      ).run(createId("wal"), userId, now);

      db.prepare(
        `INSERT INTO PlayerStats (id, userId, updatedAt) VALUES (?, ?, ?)`
      ).run(createId("stat"), userId, now);

      if (referrer) {
        db.prepare(
          `INSERT INTO Referral (id, referrerId, referredUserId, bonusAmount, bonusPaidAt, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(createId("ref"), referrer.id, userId, SIGNUP_REFERRAL_BONUS_PAISE, now, now);

        db.prepare(
          `UPDATE Wallet SET bonusBalance = bonusBalance + ?, updatedAt = ? WHERE userId = ?`
        ).run(SIGNUP_REFERRAL_BONUS_PAISE, now, referrer.id);

        const referrerWallet = db
          .prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?")
          .get(referrer.id) as { depositBalance: number; winningBalance: number; bonusBalance: number };
        const total = referrerWallet.depositBalance + referrerWallet.winningBalance + referrerWallet.bonusBalance;

        db.prepare(
          `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, createdAt)
           VALUES (?, ?, 'REFERRAL_BONUS', 'COMPLETED', ?, ?, ?, ?, ?)`
        ).run(
          createId("txn"),
          referrer.id,
          SIGNUP_REFERRAL_BONUS_PAISE,
          total,
          createReferenceId("REF"),
          "Referral signup bonus",
          now
        );

        db.prepare(
          `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'REFERRAL_BONUS', ?, ?, ?)`
        ).run(
          createId("notif"),
          referrer.id,
          "Referral bonus credited! 🎉",
          `You earned ₹50 because ${input.username} joined using your referral code.`,
          now
        );
      }
    });
    tx();

    const accessToken = signAccessToken({ sub: userId, role: "USER", status: "ACTIVE" });
    const refreshToken = createRefreshTokenValue();
    db.prepare(
      `INSERT INTO Session (id, userId, refreshToken, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`
    ).run(createId("sess"), userId, refreshToken, refreshTokenExpiry().toISOString(), now);

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_COOKIE_NAME, accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 15 });
    cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

    return ok({ id: userId, username: input.username, email: input.email }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
