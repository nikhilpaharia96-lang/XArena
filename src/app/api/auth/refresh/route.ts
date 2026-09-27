import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { signAccessToken, REFRESH_COOKIE_NAME, ACCESS_COOKIE_NAME } from "@/server/lib/auth";

interface SessionRow {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
}
interface UserRow {
  id: string;
  role: string;
  status: string;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
    if (!refreshToken) {
      throw new ApiError(401, "No active session.", "NO_SESSION");
    }

    const session = db
      .prepare("SELECT id, userId, expiresAt, revokedAt FROM Session WHERE refreshToken = ?")
      .get(refreshToken) as SessionRow | undefined;

    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      throw new ApiError(401, "Session expired. Please log in again.", "SESSION_EXPIRED");
    }

    const user = db.prepare("SELECT id, role, status FROM User WHERE id = ?").get(session.userId) as
      | UserRow
      | undefined;
    if (!user || user.status === "BANNED" || user.status === "SUSPENDED") {
      throw new ApiError(403, "Account is not active.", "ACCOUNT_INACTIVE");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role, status: user.status });
    cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });

    return ok({ refreshed: true });
  } catch (error) {
    return fail(error);
  }
}
