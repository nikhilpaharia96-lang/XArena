import { cookies } from "next/headers";
import { db } from "@/server/db/client";
import { verifyAccessToken, ACCESS_COOKIE_NAME } from "@/server/lib/auth";
import { ApiError } from "@/server/lib/api-response";

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  avatarUrl: string | null;
}

/**
 * Resolves the authenticated user from the access-token cookie.
 * Used at the top of every protected route handler. Throws ApiError(401)
 * if there is no valid session — callers should let this bubble up to
 * their catch block, which routes it through fail().
 *
 * Equivalent in the NestJS target architecture: a JwtAuthGuard + a
 * @CurrentUser() param decorator backed by Passport's JWT strategy.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) {
    throw new ApiError(401, "You need to be logged in to do that.", "UNAUTHENTICATED");
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    throw new ApiError(401, "Your session has expired. Please log in again.", "SESSION_EXPIRED");
  }

  const user = db
    .prepare("SELECT id, email, username, role, status, avatarUrl FROM User WHERE id = ?")
    .get(payload.sub) as CurrentUser | undefined;

  if (!user) {
    throw new ApiError(401, "Account not found.", "UNAUTHENTICATED");
  }
  if (user.status === "BANNED" || user.status === "SUSPENDED") {
    throw new ApiError(403, "This account is not active.", "ACCOUNT_INACTIVE");
  }

  return user;
}

/** Throws ApiError(403) unless the user has one of the allowed roles. */
export function requireRole(user: CurrentUser, ...roles: string[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "You don't have permission to do that.", "FORBIDDEN");
  }
}
