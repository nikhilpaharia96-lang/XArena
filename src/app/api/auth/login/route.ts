import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import {
  verifyPassword,
  signAccessToken,
  createRefreshTokenValue,
  refreshTokenExpiry,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "@/server/lib/auth";
import { createId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { loginSchema } from "@/types/schemas";
import { cookies } from "next/headers";

interface UserRow {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
}

export async function POST(req: Request) {
  try {
    // Tight limit: 8 attempts / 5 min per IP — slows credential stuffing
    // without punishing normal mistyped-password retries.
    const { allowed } = checkRateLimit(`login:${getClientKey(req)}`, 8, 5 * 60_000);
    if (!allowed) {
      throw new ApiError(429, "Too many login attempts. Try again in a few minutes.");
    }

    const body = await req.json();
    const input = loginSchema.parse(body);

    const user = db
      .prepare("SELECT id, email, username, passwordHash, role, status, avatarUrl FROM User WHERE email = ?")
      .get(input.email) as UserRow | undefined;

    // Constant-shape response whether the email exists or not, to avoid
    // leaking which emails are registered via response-time / message diffs.
    if (!user || !user.passwordHash) {
      throw new ApiError(401, "Incorrect email or password.", "INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Incorrect email or password.", "INVALID_CREDENTIALS");
    }

    if (user.status === "BANNED") {
      throw new ApiError(403, "This account has been banned. Contact support if you think this is a mistake.", "ACCOUNT_BANNED");
    }
    if (user.status === "SUSPENDED") {
      throw new ApiError(403, "This account is temporarily suspended.", "ACCOUNT_SUSPENDED");
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE User SET lastLoginAt = ? WHERE id = ?").run(now, user.id);

    const accessToken = signAccessToken({ sub: user.id, role: user.role, status: user.status });
    const refreshToken = createRefreshTokenValue();
    db.prepare(
      `INSERT INTO Session (id, userId, refreshToken, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`
    ).run(createId("sess"), user.id, refreshToken, refreshTokenExpiry().toISOString(), now);

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_COOKIE_NAME, accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 15 });
    cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });

    return ok({ id: user.id, email: user.email, username: user.username, role: user.role, avatarUrl: user.avatarUrl });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
